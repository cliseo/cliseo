from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from requests.exceptions import RequestException

app = Flask(__name__)
# Configure CORS to allow all origins during development
CORS(app, 
     resources={
         r"/*": {
             "origins": "*",  # Allow all origins in development
             "methods": ["GET", "POST", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": False,
             "max_age": 3600
         }
     })

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

def detect_framework(url):
    try:
        # Add http:// if not present
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Get the webpage content
        try:
            response = requests.get(url, timeout=10)  # Add timeout
            response.raise_for_status()  # Raise an error for bad status codes
        except requests.exceptions.Timeout:
            return {
                'compatible': False,
                'error': 'Request timed out. Please check the URL and try again.'
            }
        except requests.exceptions.SSLError:
            return {
                'compatible': False,
                'error': 'SSL certificate verification failed. The site might not be secure.'
            }
        except requests.exceptions.ConnectionError:
            return {
                'compatible': False,
                'error': 'Could not connect to the website. Please check the URL and try again.'
            }
        except requests.exceptions.HTTPError as e:
            return {
                'compatible': False,
                'error': f'HTTP Error: {str(e)}'
            }
        except requests.exceptions.RequestException as e:
            return {
                'compatible': False,
                'error': f'Error accessing the website: {str(e)}'
            }

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Initialize framework indicators
        frameworks = {
            'React': False,
            'Vue': False,
            'Angular': False,
            'Next.js': False,
            'Wix': False,
            'Squarespace': False,
            'Shopify': False,
            'Webflow': False
        }
        
        try:
            # Check meta tags and scripts
            for meta in soup.find_all('meta'):
                content = str(meta.get('content', '')).lower()
                if 'react' in content:
                    frameworks['React'] = True
                # elif 'vue' in content:
                #     frameworks['Vue'] = True
                elif 'angular' in content:
                    frameworks['Angular'] = True
                elif 'next' in content:
                    frameworks['Next.js'] = True


            # Check script tags
            for script in soup.find_all('script'):
                src = str(script.get('src', '')).lower()
                if 'react' in src:
                    frameworks['React'] = True
                # elif 'vue' in src:
                #     frameworks['Vue'] = True
                elif 'angular' in src:
                    frameworks['Angular'] = True
                elif 'next' in src:
                    frameworks['Next.js'] = True

            # Check for specific framework indicators in the page source
            page_source = str(soup).lower()
            if 'data-reactroot' in page_source or 'react-root' in page_source:
                frameworks['React'] = True
            # if 'v-for' in page_source or 'v-if' in page_source:
            #     frameworks['Vue'] = True
            if 'ng-' in page_source or 'angular' in page_source:
                frameworks['Angular'] = True
            if '__next' in page_source:
                frameworks['Next.js'] = True
                
            # Check for known website builder signatures
            if 'wixsite.com' in url or 'static.parastorage.com' in page_source or 'wix.com' in page_source:
                frameworks['Wix'] = True
            if 'squarespace.com' in page_source or 'content="Squarespace"' in page_source:
                frameworks['Squarespace'] = True
            if 'cdn.shopify.com' in page_source or 'content="Shopify"' in page_source or 'shopify' in page_source:
                frameworks['Shopify'] = True
            if 'webflow.com' in page_source or 'content="Webflow"' in page_source:
                frameworks['Webflow'] = True
                
            # Check if the site uses an unsupported site builder
            site_builders = ['Wix', 'Squarespace', 'Shopify', 'Webflow']
            detected_builders = [fw for fw in site_builders if frameworks[fw]]

            if detected_builders:
                return {
                    'compatible': False,
                    'error': f"Framework not supported: {', '.join(detected_builders)}"
                }

            # Get the detected frameworks
            detected = [fw for fw, detected in frameworks.items() if detected]
            
            if detected:
                return {
                    'compatible': True,
                    'frameworks': detected
                }
            else:
                return {
                    'compatible': True,
                    'frameworks': ['Unknown']
                }

        except Exception as e:
            return {
                'compatible': False,
                'error': f'Error parsing website content: {str(e)}'
            }

    except Exception as e:
        return {
            'compatible': False,
            'error': f'Unexpected error: {str(e)}'
        }

@app.route('/api/check-site', methods=['POST'])
def check_site():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'compatible': False,
                'error': 'No data provided'
            }), 400
        
        if 'url' not in data:
            return jsonify({
                'compatible': False,
                'error': 'URL is required'
            }), 400
        
        if not isinstance(data['url'], str):
            return jsonify({
                'compatible': False,
                'error': 'URL must be a string'
            }), 400
        
        url = data['url'].strip()
        if not url:
            return jsonify({
                'compatible': False,
                'error': 'URL cannot be empty'
            }), 400

        result = detect_framework(url)
        return jsonify(result)

    except Exception as e:
        return jsonify({
            'compatible': False,
            'error': f'Server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001) 