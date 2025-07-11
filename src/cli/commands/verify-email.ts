import chalk from 'chalk';
import inquirer from 'inquirer';
import axios from 'axios';
import ora from 'ora';
import { getAuthToken, loadConfig, isAuthenticated } from '../utils/config.js';

// Backend configuration
const API_BASE = 'https://a8iza6csua.execute-api.us-east-2.amazonaws.com';

interface VerificationStatusResponse {
  email: string;
  email_verified: boolean;
  email_verified_at?: string;
  provider: string;
  requires_verification: boolean;
  auth0_verified?: boolean;
}

interface SendVerificationResponse {
  message: string;
  job_id?: string;
  verified?: boolean;
}

/**
 * Check current email verification status
 */
async function checkVerificationStatus(): Promise<VerificationStatusResponse | null> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${API_BASE}/verification-status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      throw new Error(errorData.error || 'Failed to check verification status');
    }
    throw new Error('Failed to check verification status');
  }
}

/**
 * Send verification email
 */
async function sendVerificationEmail(): Promise<SendVerificationResponse> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${API_BASE}/send-verification`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      throw new Error(errorData.error || 'Failed to send verification email');
    }
    throw new Error('Failed to send verification email');
  }
}

/**
 * Format provider display name
 */
function formatProvider(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'auth0':
    case 'email':
      return 'Email/Password';
    default:
      return provider;
  }
}

/**
 * Main verify-email command
 */
export async function verifyEmailCommand() {
  console.log(chalk.bold('\n📧 Email Verification\n'));

  // Check if user is authenticated
  if (!await isAuthenticated()) {
    console.log(chalk.red('❌ You must be authenticated to use this command.'));
    console.log(chalk.gray('Run "cliseo auth" to authenticate first.'));
    return;
  }

  const spinner = ora('Checking verification status...').start();

  try {
    // Check current verification status
    const status = await checkVerificationStatus();
    spinner.stop();

    if (!status) {
      console.log(chalk.red('❌ Unable to check verification status.'));
      return;
    }

    const config = await loadConfig();
    console.log(chalk.cyan(`📧 Email: ${config.userEmail}`));
    console.log(chalk.cyan(`🔐 Provider: ${formatProvider(status.provider)}`));
    
    if (!status.requires_verification) {
      console.log(chalk.green('✅ Email verification not required for your provider'));
      console.log(chalk.gray('Your email is automatically trusted by this provider.'));
      return;
    }

    if (status.email_verified) {
      console.log(chalk.green('✅ Email is verified'));
      if (status.email_verified_at) {
        const verifiedDate = new Date(status.email_verified_at).toLocaleDateString();
        console.log(chalk.gray(`   Verified on: ${verifiedDate}`));
      }
      console.log(chalk.green('\n🎉 You have full access to all features!'));
      return;
    }

    // Email is not verified
    console.log(chalk.red('❌ Email is not verified'));
    console.log(chalk.yellow('\n⚠️  Email verification is required to access AI features.'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Send verification email', value: 'send' },
          { name: 'Check status again', value: 'check' },
          { name: 'Cancel', value: 'cancel' }
        ],
      },
    ]);

    switch (action) {
      case 'send':
        await handleSendVerification();
        break;
      case 'check':
        // Recursively call the command to check again
        await verifyEmailCommand();
        break;
      case 'cancel':
        console.log(chalk.gray('Cancelled.'));
        break;
    }

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.gray('Please try again or contact support if the issue persists.'));
  }
}

/**
 * Handle sending verification email
 */
async function handleSendVerification() {
  const spinner = ora('Sending verification email...').start();

  try {
    const result = await sendVerificationEmail();
    spinner.stop();

    if (result.verified) {
      console.log(chalk.green('✅ ' + result.message));
      return;
    }

    console.log(chalk.green('✅ Verification email sent!'));
    console.log(chalk.cyan('\n📬 Please check your email inbox (and spam folder) for a verification link.'));
    console.log(chalk.gray('The verification link will expire after some time, so please use it soon.'));
    
    if (result.job_id) {
      console.log(chalk.gray(`Job ID: ${result.job_id}`));
    }

    console.log(chalk.yellow('\n💡 Tips:'));
    console.log(chalk.gray('• Check your spam/junk folder if you don\'t see the email'));
    console.log(chalk.gray('• Make sure your email address is correct'));
    console.log(chalk.gray('• Run "cliseo verify-email" again to check status after clicking the link'));
    console.log(chalk.gray('• Contact support if you continue having issues'));

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ Failed to send verification email: ${error instanceof Error ? error.message : 'Unknown error'}`));
    
    // Provide helpful troubleshooting info
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('already verified')) {
        console.log(chalk.green('\n✅ Good news! Your email is already verified.'));
        console.log(chalk.gray('Run "cliseo verify-email" to confirm your status.'));
      } else if (errorMessage.includes('user not found')) {
        console.log(chalk.yellow('\n⚠️  Your account may not be properly synced.'));
        console.log(chalk.gray('Try running "cliseo auth" to re-authenticate.'));
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        console.log(chalk.yellow('\n⚠️  Too many verification emails sent recently.'));
        console.log(chalk.gray('Please wait a few minutes before trying again.'));
      }
    }
  }
}

/**
 * Check verification status (utility function for other commands)
 */
export async function getEmailVerificationStatus(): Promise<VerificationStatusResponse | null> {
  try {
    return await checkVerificationStatus();
  } catch (error) {
    return null;
  }
}

/**
 * Check if email verification is required and not completed
 */
export async function requiresEmailVerification(): Promise<boolean> {
  try {
    const status = await checkVerificationStatus();
    if (!status) return false;
    
    return status.requires_verification && !status.email_verified;
  } catch (error) {
    return false;
  }
} 