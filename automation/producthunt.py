import os
import pickle
import re
from urllib.parse import urlparse
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
load_dotenv()

def save_cookies(driver, path):
    with open(path, 'wb') as file:
        pickle.dump(driver.get_cookies(), file)

def load_cookies(driver, path):
    try:
        with open(path, 'rb') as file:
            cookies = pickle.load(file)
            for cookie in cookies:
                driver.add_cookie(cookie)
        return True
    except:
        return False

# Get product links
def get_top_products():
    # Initialize undetected-chromedriver
    options = uc.ChromeOptions()
    driver = uc.Chrome(options=options)
    
    try:
        print("Opening Product Hunt...")
        driver.get("https://www.producthunt.com/")
        
        # Check for saved cookies
        if not load_cookies(driver, './producthunt_cookies.pkl'):
            print("\n⚠️ Please solve the Cloudflare challenge manually in the browser window.")
            print("After solving, the script will save the cookies and continue.")
            print("Waiting for manual intervention...")
            
            # Wait for a reasonable amount of time for manual solving
            time.sleep(20)  # Adjust this if you need more time
            
            # Save cookies after challenge is solved
            save_cookies(driver, 'producthunt_cookies.pkl')
            print("✓ Cookies saved for future use")
        else:
            print("✓ Using saved cookies")
            driver.refresh()  # Refresh with loaded cookies
        
        time.sleep(5)  # Wait for page to load

        print("Waiting for page to load...")
        # Count products before clicking
        soup = BeautifulSoup(driver.page_source, "html.parser")
        main_section = soup.find("div", attrs={"data-test": "homepage-section-0"})
        before_count = len(main_section.find_all("section", attrs={"data-test": lambda x: x and x.startswith("post-item-")})) if main_section else 0
        print(f"Products before click: {before_count}")

        # Find and scroll to the button
        try:
            print("Looking for 'See all' button...")
            button = WebDriverWait(driver, 15).until(  # Increased wait time
                EC.element_to_be_clickable((By.XPATH, "//button[.//span[contains(text(), \"See all of today's products\")]]"))
            )
            print("Found button, scrolling to it...")
            driver.execute_script("arguments[0].scrollIntoView();", button)
            time.sleep(2)  # Give more time after scrolling
            print("Clicking button...")
            button.click()
            print("Clicked the button.")
            time.sleep(7)  # Give more time for products to load
        except Exception as e:
            print("Button not found or not clickable:", e)

        # Get updated page source after clicking
        print("Extracting products...")
        soup = BeautifulSoup(driver.page_source, "html.parser")
        main_section = soup.find("div", attrs={"data-test": "homepage-section-0"})
        
        # Extract product links using the new structure
        product_links = []
        if main_section:
            # Find all product sections
            product_sections = main_section.find_all("section", attrs={"data-test": lambda x: x and x.startswith("post-item-")})
            print(f"Found {len(product_sections)} product sections")
            
            for section in product_sections:
                try:
                    # Try to find the product link directly
                    product_link = section.find("a", href=True)
                    if product_link and product_link["href"].startswith("/posts/"):
                        product_url = f"https://www.producthunt.com{product_link['href']}"
                        product_name = product_link.get_text().strip()
                        product_links.append(product_url)
                        print(f"Found product: {product_name} -> {product_url}")
                    else:
                        # Fallback to button approach
                        product_button = section.find("button", attrs={"data-test": "post-name-link"})
                        if product_button:
                            product_name = product_button.get_text().strip()
                            if product_name:
                                product_url = f"https://www.producthunt.com/posts/{product_name.lower().replace(' ', '-')}"
                                product_links.append(product_url)
                                print(f"Found product (via button): {product_name} -> {product_url}")
                except Exception as e:
                    print(f"Error extracting product: {e}")
                    continue

        product_links = list(set(product_links))
        print(f"\nTotal unique products found: {len(product_links)}")
        return product_links

    finally:
        driver.quit()

def is_valid_product_url(url):
    """Check if a URL is likely to be a valid product website."""
    if not url:
        return False
    
    # Skip common non-product URLs
    skip_domains = [
        'producthunt.com', 'twitter.com', 'x.com', 'facebook.com',
        'linkedin.com', 'instagram.com', 'github.com', 'youtube.com',
        'medium.com', 'lu.ma', 'google.com', 'wikipedia.org'
    ]
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Skip if domain contains any of the skip domains
        if any(skip in domain for skip in skip_domains):
            return False
            
        # Skip URLs that are clearly search results or social media profiles
        if any(term in url.lower() for term in ['search?', 'profile', '/search/', '/users/']):
            return False
            
        return True
    except:
        return False

def search_product_website(product_name):
    """Search for the product's website using DuckDuckGo."""
    try:
        # Clean the product name
        clean_name = product_name.replace('-', ' ').strip()
        search_query = f"what is {clean_name} on product hunt -producthunt -twitter -facebook"
        
        # Make the search request to DuckDuckGo
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(
            f"https://api.duckduckgo.com/?q={search_query}&format=json&no_html=1&no_redirect=1&kl=wt-wt",
            headers=headers
        )
        
        if response.status_code == 200:
            results = response.json()
            
            # First check the AbstractURL (usually the most relevant result)
            abstract_url = results.get('AbstractURL')
            if abstract_url and is_valid_product_url(abstract_url):
                return abstract_url
                
            # Then check Related Topics
            for topic in results.get('RelatedTopics', []):
                url = topic.get('FirstURL')
                if url and is_valid_product_url(url):
                    return url
                    
            # If no valid URLs found in abstract or related topics,
            # try the redirect URL from the main result
            redirect_url = results.get('Redirect')
            if redirect_url and is_valid_product_url(redirect_url):
                return redirect_url
                
        return None
    except Exception as e:
        print(f"Search error: {e}")
        return None

def get_product_website(product_post_url):
    try:
        # Extract product name from URL
        product_name = product_post_url.split('/')[-1]
        print(f"\nSearching for website of: {product_name}")
        
        # Search for the product website
        website_url = search_product_website(product_name)
        if website_url:
            print(f"Found website URL: {website_url}")
            return website_url
        else:
            print("Could not find website URL")
            return None
            
    except Exception as e:
        print(f"Error finding website URL: {e}")
        return None

# Example usage:
if __name__ == "__main__":
    print("Starting Product Hunt scraper...")
    links = get_top_products()
    if links:
        print(f"\nTesting with first 5 products:")
        for link in links[:5]:  # Only process first 5 links
            website = get_product_website(link)
            print(f"{link} -> {website}")
            time.sleep(1)  # Be nice to the API
    else:
        print("No product links found.")

# Get emails
def find_emails_on_website(base_url):

    COMMON_PATHS = ['', 'about', 'contact', 'team', 'info', 'support']
    found_emails = set()
    parsed = urlparse(base_url)
    root = f"{parsed.scheme}://{parsed.netloc}"

    for path in COMMON_PATHS:
        url = urljoin(root + '/', path) if path else base_url
        try:
            resp = requests.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href']
                if href.startswith('mailto:'):
                    email = href[7:].split('?')[0]
                    found_emails.add(email)
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    return list(found_emails)

# # Example usage:
# emails = find_emails_on_website("https://www.morphik.ai/?ref=producthunt")
# print(emails)

# Get issues
def get_issues(url):
    api_key = os.getenv('PAGESPEED_INSIGHTS_API_KEY')
    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    params = {'category': 'SEO', 'url': url, 'key': api_key,}

    try:
        response = requests.get(api_url, params=params)
        audits = response.json()['lighthouseResult']['audits']

        for audit_id, audit in audits.items():
            if audit['score'] == 0:
                description = audit['description']

                if audit['id'] == 'robots-txt': 
                    description = f"""The content in your robots.txt file:"{audit['details']['items'][0]['line'][:100]}..." is invalid. {audit['description']}"""
                # Other specific audits

                print(f"{audit_id}: {description}\n")

            else: pass

    except requests.exceptions.RequestException as e: 
        print(f"Error: {e}")

    return

def get_product_website(product_post_url):
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(options=chrome_options)
    website_url = None

    try:
        driver.get(product_post_url)
        time.sleep(3)  # Wait for page to load

        soup = BeautifulSoup(driver.page_source, "html.parser")
        # Find the button with the "Visit" text
        visit_button = soup.find("button", string=lambda s: s and "Visit" in s)
        if visit_button:
            # Try to find an <a> inside the button
            a_tag = visit_button.find("a", href=True)
            if a_tag:
                website_url = a_tag["href"]
            else:
                # Try to find the parent <a>
                parent_a = visit_button.find_parent("a", href=True)
                if parent_a:
                    website_url = parent_a["href"]
        else:
            # Fallback: look for any <a> with "Visit" text
            a_tag = soup.find("a", string=lambda s: s and "Visit" in s, href=True)
            if a_tag:
                website_url = a_tag["href"]

    finally:
        driver.quit()

    return website_url