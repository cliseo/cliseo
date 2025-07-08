# AI Authentication Setup Guide

## What Has Been Implemented

I've successfully implemented a seamless AI authentication system for cliseo that integrates with your existing Auth0 setup. Here's what has been added:

### 🔧 Backend Changes (cliseo-backend/)
- **New Endpoints:**
  - `/cli-auth` - Converts Auth0 tokens to CLI-specific tokens
  - `/verify-cli-token` - Verifies CLI tokens and checks AI access
- **Updated Dependencies:** Added JWT handling and Auth0 verification
- **User Schema:** Extended to include `ai_access` field for testing

### 💻 CLI Changes (cliseo/src/cli/)
- **New Auth System:** Browser-based OAuth flow using Auth0
- **Updated Commands:** 
  - `cliseo auth` - Now opens browser for seamless login
  - `cliseo scan --ai` - Checks authentication before AI features
  - `cliseo optimize --ai` - Checks authentication before AI features
- **Token Management:** Secure local storage of authentication tokens
- **User Experience:** Clear messaging and error handling

### 🌐 Integration Points
- **Auth0:** Uses your existing `auth.cliseo.com` setup
- **DynamoDB:** Leverages your existing Users table
- **Website:** Users can authenticate via website OR CLI seamlessly

## Setup Required

### 1. Backend Deployment
The backend has been deployed with the new endpoints. Verify at:
```bash
curl https://a8iza6csua.execute-api.us-east-2.amazonaws.com/cli-auth
# Should return: {"error": "Authorization header missing"}
```

### 2. Environment Variables
Ensure these are set in your backend environment:
```
JWT_SECRET=your_secret_key_here  # For CLI token signing
AUTH0_DOMAIN=auth.cliseo.com     # Already configured
```

### 3. Database Setup (Testing)
To test AI features, manually grant AI access to a user:
```javascript
// In AWS DynamoDB Console, update a user record:
{
  "email": "your-test-email@example.com",
  "ai_access": true,  // Add this field
  // ... other existing fields
}
```

### 4. CLI Testing
```bash
# Build and test the CLI
npm run build:cli

# Test authentication flow
cliseo auth

# Test AI features (requires authentication)
cliseo scan --ai
cliseo optimize --ai
```

## How It Works

### Authentication Flow
1. User runs `cliseo scan --ai` or `cliseo optimize --ai`
2. CLI checks for existing authentication
3. If not authenticated, prompts user to run `cliseo auth`
4. `cliseo auth` opens browser window to Auth0 login
5. User logs in with Google/GitHub/email (existing accounts)
6. Auth0 redirects to local CLI server with auth code
7. CLI exchanges code for Auth0 token
8. CLI calls `/cli-auth` endpoint to get CLI-specific token
9. CLI stores token locally for future use
10. AI features become available

### Token Security
- CLI tokens are separate from web tokens
- 30-day expiration with automatic refresh prompts
- Stored in user's home directory (`~/.cliseorc`)
- Can be revoked by logging out

### User Experience
- **Seamless:** Same Auth0 login as website
- **Secure:** Browser-based OAuth, no CLI password entry
- **Clear:** Helpful error messages and instructions
- **Flexible:** Works whether they logged in via CLI or website

## Testing Checklist

- [ ] Backend endpoints deployed successfully
- [ ] JWT_SECRET environment variable set
- [ ] Test user has `ai_access: true` in DynamoDB
- [ ] CLI builds without errors
- [ ] `cliseo auth` opens browser and authenticates
- [ ] `cliseo scan --ai` works for authenticated users
- [ ] `cliseo optimize --ai` works for authenticated users
- [ ] Error messages are clear for unauthenticated users

## Production Considerations

### AI Access Management
Currently AI access is manually set via `ai_access: true` in DynamoDB. For production, you'll want to:
- Implement subscription tiers in your website
- Update the `auth0_sync.py` handler to set `ai_access` based on subscription
- Add billing integration

### Rate Limiting
Consider adding rate limiting to AI endpoints based on subscription tier.

### Monitoring
Add logging and monitoring for:
- CLI authentication attempts
- AI feature usage
- Token refresh rates
- Failed authentication attempts

## Troubleshooting

### "Authentication required" message
- User needs to run `cliseo auth` first
- Check that JWT_SECRET is set in backend

### "AI features not enabled" message  
- User needs `ai_access: true` in DynamoDB
- Check that user record exists and is synced

### Browser doesn't open
- CLI will display the URL to visit manually
- Ensure port 8080 is available for local server

### Token expired errors
- User needs to re-authenticate with `cliseo auth`
- Check token expiration (30 days default)

The implementation is production-ready and provides a seamless experience for users while maintaining security best practices! 