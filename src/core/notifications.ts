import fetch from 'node-fetch';
import { P5Config } from '../types/config.js';
import chalk from 'chalk';

export async function sendNotification(
  config: P5Config,
  message: string,
  branch: string,
  suspect?: { author: string; sha: string }
): Promise<boolean> {
  if (config.notifications.provider === 'none' || !config.notifications.webhook) {
    return false;
  }

  const suspectText = suspect ? ` Likely: @${suspect.author} (${suspect.sha})` : '';
  const fullMessage = `[P5] ❌ ${message} on branch ${branch}.${suspectText}`;

  try {
    let payload: any;
    
    if (config.notifications.provider === 'slack') {
      payload = { text: fullMessage };
    } else if (config.notifications.provider === 'discord') {
      payload = { content: fullMessage };
    } else {
      return false;
    }

    const response = await fetch(config.notifications.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(chalk.green('✅ Notification sent successfully'));
      return true;
    } else {
      console.log(chalk.yellow(`⚠️  Failed to send notification: ${response.status}`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error sending notification: ${error}`));
    return false;
  }
}

export async function postCiFailure(
  config: P5Config,
  step: string,
  branch: string,
  suspect?: { author: string; sha: string }
): Promise<void> {
  await sendNotification(config, `${step} failed`, branch, suspect);
}
