import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { authenticateUser, logoutUser } from '../utils/auth.js';
import { isAuthenticated, hasAiAccess, loadConfig } from '../utils/config.js';

// Helper function to format email display
function formatEmailDisplay(email: string): string {
  // For GitHub users without public email
  if (email && email.includes('@github.user')) {
    const username = email.split('@')[0];
    return `Github: ${username}`;
  }
  
  // For Google users, check if it's a placeholder
  if (email && email.includes('placeholder')) {
    return 'Google: (private email)';
  }
  
  // For real emails, show as-is
  return email || 'Not provided';
}

export async function authCommand() {
  console.log(chalk.bold('\n🔐 cliseo Authentication\n'));
  
  // Check current authentication status
  const isCurrentlyAuth = await isAuthenticated();
  const hasAi = await hasAiAccess();
  
  if (isCurrentlyAuth) {
    const config = await loadConfig();
    console.log(chalk.green('✅ You are currently authenticated'));
          console.log(chalk.cyan(`🔒 ${formatEmailDisplay(config.userEmail || '')}`));
      if (hasAi) {
        console.log(chalk.magentaBright(`🤖 AI Access: Enabled`));
      } else {
        console.log(chalk.magentaBright(`🤖 AI Access: Disabled`));
        console.log(chalk.gray(`   Visit https://cliseo.com to upgrade`));
      }
    console.log(''); // Add line break for better spacing
    
    const choices = [];
    if (!hasAi) {
      choices.push({ name: 'Upgrade to unlock AI features', value: 'upgrade' });
    }
    choices.push(
      { name: 'Log out', value: 'logout' },
      { name: 'Cancel', value: 'cancel' }
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices,
      },
    ]);

    switch (action) {
      case 'upgrade':
        await openUpgradePage();
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
  const result = await authenticateUser();

  if (result.success) {
    console.log(chalk.green('\n✅ Authentication successful!'));
    console.log(chalk.cyan(`🔒 ${formatEmailDisplay(result.email || '')}`));
    
    if (result.aiAccess) {
      console.log(chalk.magentaBright(`🤖 AI Access: Enabled`));
      console.log(chalk.green('\n🎉 You can now use AI-powered features with the --ai flag:'));
      console.log(chalk.cyan('  cliseo scan --ai'));
      console.log(chalk.cyan('  cliseo optimize --ai'));
    } else {
      console.log(chalk.magentaBright(`🤖 AI Access: Disabled`));
      console.log(chalk.gray(`   Visit https://cliseo.com to upgrade`));
    }
  } else {
    console.log(chalk.red('\n❌ Authentication failed:'));
    console.log(chalk.red(result.error || 'Unknown error occurred'));
    console.log(chalk.gray('\nPlease try again or visit https://cliseo.com/ for support.'));
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

async function openUpgradePage() {
  const upgradeUrl = 'https://cliseo.com';
  
  console.log(chalk.cyan('\n🚀 Opening upgrade page...'));
  
  try {
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${upgradeUrl}"`;
    } else if (platform === 'win32') {
      command = `start "" "${upgradeUrl}"`;
    } else {
      command = `xdg-open "${upgradeUrl}"`;
    }

    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    console.log(chalk.green('✅ Upgrade page opened in your browser'));
    console.log(chalk.gray('Choose a plan that includes AI features to unlock optimization'));
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Could not open browser automatically.'));
    console.log(chalk.cyan('Please visit the following URL to upgrade:'));
    console.log(chalk.blue(upgradeUrl));
  }
} 