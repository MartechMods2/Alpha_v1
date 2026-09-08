export const OPERATION_CATEGORIES = Object.freeze([
  'Navigate',
  'Automation',
  'Activity',
  'Moderation',
  'Community',
])

export const DASHBOARD_OPERATIONS = Object.freeze([
  { id: 'overview', icon: '◫', label: 'Overview', description: 'Live bot summary, health and activity.', category: 'Navigate', to: '/' },
  { id: 'control-center', icon: '⚡', label: 'Control Center', description: 'Group protection and readiness controls.', category: 'Navigate', to: '/control-center' },
  { id: 'templates', icon: '🧩', label: 'Template Library', description: 'Browse Alpha’s built-in communication templates.', category: 'Navigate', to: '/templates' },
  { id: 'commands', icon: '⌘', label: 'Command Registry', description: 'Search and enable or disable bot commands.', category: 'Navigate', to: '/commands' },
  { id: 'groups', icon: '👥', label: 'Group Manager', description: 'Manage every connected WhatsApp group.', category: 'Navigate', to: '/groups' },
  { id: 'members', icon: '👤', label: 'Member Directory', description: 'Search members and moderation records.', category: 'Navigate', to: '/members' },
  { id: 'analytics', icon: '◒', label: 'Analytics', description: 'Review message and group activity trends.', category: 'Navigate', to: '/analytics' },
  { id: 'dm', icon: '✉', label: 'Direct Message', description: 'Send a direct message from Alpha.', category: 'Navigate', to: '/dm' },
  { id: 'broadcast', icon: '📢', label: 'Safe Broadcast', description: 'Send a controlled message to selected groups.', category: 'Navigate', to: '/broadcast' },
  { id: 'logs', icon: '≡', label: 'Live Logs', description: 'Inspect runtime logs and recent bot events.', category: 'Navigate', to: '/logs' },
  { id: 'health', icon: '♡', label: 'Bot Health', description: 'Inspect uptime, memory and connection health.', category: 'Navigate', to: '/health' },
  { id: 'media', icon: '🎬', label: 'Media Studio', description: 'Manage stickers, media jobs and providers.', category: 'Navigate', to: '/media-studio' },
  { id: 'safe-pack', icon: '🛡', label: 'Safe Pack', description: 'Inspect protection, automations and queue health.', category: 'Navigate', to: '/safe-pack' },
  { id: 'settings', icon: '⚙', label: 'Settings', description: 'Manage deployment and dashboard settings.', category: 'Navigate', to: '/settings' },

  { id: 'automation-on', icon: '⚡', label: 'Enable Automation Pack', description: 'Enable the recommended new-group automation set.', category: 'Automation', command: '$automationpack on' },
  { id: 'automation-status', icon: '◉', label: 'Automation Status', description: 'Show current recommended automation state.', category: 'Automation', command: '$automationpack status' },
  { id: 'group-pulse', icon: '📡', label: 'Group Pulse', description: 'Run Alpha’s group-management readiness report.', category: 'Automation', command: '$grouppulse' },
  { id: 'birthday-auto', icon: '🎂', label: 'Birthday Automation', description: 'Enable automatic birthday greetings.', category: 'Automation', command: '$birthdayauto on' },
  { id: 'event-alerts', icon: '📅', label: 'Event Alerts', description: 'Enable milestone reminders for saved events.', category: 'Automation', command: '$eventalerts on' },
  { id: 'morning-auto', icon: '☀', label: 'Morning Greeting', description: 'Enable the scheduled morning message.', category: 'Automation', command: '$morningauto on' },
  { id: 'night-auto', icon: '☾', label: 'Night Greeting', description: 'Enable the scheduled good-night message.', category: 'Automation', command: '$nightauto on' },
  { id: 'group-auto-status', icon: '🕒', label: 'Schedule Status', description: 'Review all group automation times and timezone.', category: 'Automation', command: '$groupauto status' },

  { id: 'count-all', icon: '▦', label: 'Full Activity Count', description: 'Rank the current live group membership.', category: 'Activity', command: '$count' },
  { id: 'count-zero', icon: '0', label: 'Zero-Message Review', description: 'Show current members with no tracked messages.', category: 'Activity', command: '$count zero' },
  { id: 'count-inactive', icon: '◌', label: 'Inactive Review', description: 'Review the default inactive member set.', category: 'Activity', command: '$count inactive' },
  { id: 'count-min', icon: '<', label: 'Below 20 Messages', description: 'Review current members below 20 tracked messages.', category: 'Activity', command: '$count member min 20' },
  { id: 'count-60d', icon: '60', label: 'Inactive 60 Days', description: 'Review members proven inactive for 60 days.', category: 'Activity', command: '$countinactive 60d' },
  { id: 'kick-count', icon: '↗', label: 'Kick Last Count', description: 'Preview removal of the exact last count result.', category: 'Activity', command: '$kickcount' },
  { id: 'mute-count', icon: '🔇', label: 'Mute Last Count', description: 'Preview a 7-day mute for the last count result.', category: 'Activity', command: '$mutecount' },

  { id: 'danger-help', icon: '⚠', label: 'Danger Actions Guide', description: 'Show safeguarded high-impact admin commands.', category: 'Moderation', command: '$danger' },
  { id: 'kick-inactive', icon: '🚪', label: 'Kick 60d Inactive', description: 'Preview removal of proven 60-day inactive members.', category: 'Moderation', command: '$kickinactive 60d' },
  { id: 'mute-inactive', icon: '🔕', label: 'Mute 60d Inactive', description: 'Preview a mute for proven 60-day inactive members.', category: 'Moderation', command: '$muteinactive 60d' },
  { id: 'lock-group', icon: '🔒', label: 'Lock Group', description: 'Preview admin-only posting mode.', category: 'Moderation', command: '$muteall' },
  { id: 'unlock-group', icon: '🔓', label: 'Reopen Group', description: 'Restore normal group messaging.', category: 'Moderation', command: '$unmuteall' },

  { id: 'template-menu', icon: '🧰', label: 'Template Menu', description: 'Show every built-in Alpha template.', category: 'Community', command: '$templates' },
  { id: 'rules-template', icon: '📜', label: 'Rules Template', description: 'Preview the built-in group rules template.', category: 'Community', command: '$template rules' },
  { id: 'game-help', icon: '🎮', label: 'Game Help', description: 'Open Alpha’s game-engine help panel.', category: 'Community', command: '$game help' },
])

export const operationCount = DASHBOARD_OPERATIONS.length
