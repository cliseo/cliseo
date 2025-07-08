import chalk from 'chalk';
import inquirer from 'inquirer';
import { authenticateUser, logoutUser, verifyAuthentication } from '../utils/auth.js';
import { isAuthenticated, hasAiAccess, loadConfig } from '../utils/config.js';

export async function authCommand() {
  console.log(chalk.bold('\n🔐 cliseo Authentication\n'));
  
  // Check current authentication status
  const isCurrentlyAuth = await isAuthenticated();
  const hasAi = await hasAiAccess();
  
  if (isCurrentlyAuth) {
    const config = await loadConfig();
    console.log(chalk.green('✅ You are currently authenticated'));
    console.log(chalk.cyan(`📧 Email: ${config.userEmail}`));
    console.log(chalk.cyan(`🤖 AI Access: ${hasAi ? 'Enabled' : 'Disabled'}`));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Verify authentication status', value: 'verify' },
          { name: 'Log out', value: 'logout' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ]);

    switch (action) {
      case 'verify':
        await verifyAuthenticationStatus();
        break;
      case 'logout':
        await performLogout();
        break;
      case 'cancel':
        console.log(chalk.gray('Authentication cancelled.'));
        break;
    }
  } else {
    console.log(chalk.yellow('🔓 You are not currently authenticated'));
    console.log(chalk.cyan('To use AI-powered features, you need to authenticate with your cliseo account.'));
    console.log(chalk.gray('If you don\'t have an account, you can sign up at https://cliseo.com/\n'));

    const { shouldLogin } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldLogin',
        message: 'Would you like to authenticate now?',
        default: true,
      },
    ]);

    if (shouldLogin) {
      await performAuthentication();
    } else {
      console.log(chalk.gray('Authentication cancelled. You can authenticate later using `cliseo auth`.'));
    }
  }
}

async function performAuthentication() {
  console.log(chalk.cyan('\n🌐 Starting browser-based authentication...'));
  console.log(chalk.gray('A browser window will open for you to log in with your cliseo account.'));
  
  const result = await authenticateUser();

  if (result.success) {
    console.log(chalk.green('\n✅ Authentication successful!'));
    console.log(chalk.cyan(`📧 Email: ${result.email}`));
    console.log(chalk.cyan(`🤖 AI Access: ${result.aiAccess ? 'Enabled' : 'Disabled'}`));
    
    if (result.aiAccess) {
      console.log(chalk.green('\n🎉 You can now use AI-powered features with the --ai flag:'));
      console.log(chalk.cyan('  cliseo scan --ai'));
      console.log(chalk.cyan('  cliseo optimize --ai'));
    } else {
      console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account.'));
      console.log(chalk.gray('Contact support or upgrade your plan to access AI features.'));
    }
  } else {
    console.log(chalk.red('\n❌ Authentication failed:'));
    console.log(chalk.red(result.error || 'Unknown error occurred'));
    console.log(chalk.gray('\nPlease try again or visit https://cliseo.com/ for support.'));
  }
}

async function verifyAuthenticationStatus() {
  console.log(chalk.cyan('\n🔍 Verifying authentication status...'));
  
  const isValid = await verifyAuthentication();
  
  if (isValid) {
    console.log(chalk.green('✅ Authentication is valid and active'));
  } else {
    console.log(chalk.red('❌ Authentication is invalid or expired'));
    console.log(chalk.yellow('Please re-authenticate using `cliseo auth`'));
  }
}

async function performLogout() {
  const { confirmLogout } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmLogout',
      message: 'Are you sure you want to log out?',
      default: false,
    },
  ]);

  if (confirmLogout) {
    await logoutUser();
    console.log(chalk.green('\n✅ Successfully logged out'));
    console.log(chalk.gray('You can re-authenticate anytime using `cliseo auth`'));
  } else {
    console.log(chalk.gray('Logout cancelled.'));
  }
} 