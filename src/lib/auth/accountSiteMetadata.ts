export interface SiteIdentityOverride {
  readonly domains: readonly string[];
  readonly names: readonly string[];
}

/**
 * Domain-scoped issuer names used when a service has been renamed, uses a
 * shared account system, or has a web domain that differs from its 2FA label.
 *
 * Keep entries conservative:
 * - Use registrable domains or tightly scoped first-party sign-in hosts.
 * - Include only names that use the same credentials, including historical
 *   names; a corporate relationship or optional account link is not enough.
 * - Do not add user-hosted suffixes (for example, github.io or pages.dev).
 *
 * A more-specific domain wins over a parent-domain entry in the ranking
 * engine, so product-specific identities stay isolated from sibling products.
 */
export const SITE_IDENTITY_OVERRIDES = [
  // Renames and long-lived historical labels.
  { domains: ['x.com', 'twitter.com'], names: ['X', 'Twitter'] },
  { domains: ['proton.me', 'protonmail.com', 'protonvpn.com'], names: ['Proton', 'Proton Mail', 'Proton VPN', 'Proton Pass', 'Proton Drive'] },
  { domains: ['wise.com', 'transferwise.com'], names: ['Wise', 'TransferWise'] },
  { domains: ['discord.com', 'discordapp.com'], names: ['Discord', 'Discord App'] },
  { domains: ['tuta.com', 'tutanota.com'], names: ['Tuta', 'Tuta Mail', 'Tutanota'] },
  { domains: ['max.com', 'hbomax.com'], names: ['Max', 'HBO Max'] },
  { domains: ['ubisoft.com'], names: ['Ubisoft', 'Ubisoft Connect', 'Ubisoft Club', 'Uplay'] },
  { domains: ['ea.com', 'origin.com'], names: ['EA', 'Electronic Arts', 'Origin'] },
  { domains: ['goto.com', 'logmein.com'], names: ['GoTo', 'LogMeIn', 'GoTo Connect', 'GoTo Resolve'] },
  { domains: ['sign.dropbox.com', 'hellosign.com'], names: ['Dropbox Sign', 'HelloSign'] },
  { domains: ['gusto.com'], names: ['Gusto', 'ZenPayroll'] },
  { domains: ['miro.com'], names: ['Miro', 'RealtimeBoard'] },
  { domains: ['monday.com'], names: ['monday', 'dapulse'] },

  // Shared consumer and productivity account systems.
  { domains: ['accounts.google.com', 'workspace.google.com'], names: ['Google', 'Google Workspace', 'G Suite', 'Google Apps'] },
  { domains: ['gmail.com', 'googlemail.com'], names: ['Google', 'Gmail', 'Google Mail'] },
  { domains: ['youtube.com', 'youtu.be'], names: ['Google', 'YouTube'] },
  { domains: ['fitbit.com'], names: ['Fitbit', 'Google'] },
  { domains: ['nest.com'], names: ['Nest', 'Google Nest', 'Google Home', 'Google'] },
  { domains: ['icloud.com', 'me.com'], names: ['Apple', 'Apple ID', 'iCloud', 'MobileMe'] },
  { domains: ['microsoftonline.com', 'entra.microsoft.com'], names: ['Microsoft', 'Microsoft 365', 'M365', 'Office 365', 'O365', 'Azure AD', 'Azure Active Directory', 'AAD', 'Entra ID'] },
  { domains: ['login.live.com', 'account.live.com'], names: ['Microsoft', 'Live', 'Outlook', 'Hotmail'] },
  { domains: ['outlook.com', 'hotmail.com'], names: ['Microsoft', 'Outlook', 'Hotmail'] },
  { domains: ['xbox.com'], names: ['Microsoft', 'Xbox', 'Xbox Live'] },
  { domains: ['office.com', 'office365.com', 'microsoft365.com'], names: ['Microsoft', 'Microsoft 365', 'M365', 'Office', 'Office 365', 'O365'] },
  { domains: ['onedrive.com', 'onedrive.live.com'], names: ['Microsoft', 'OneDrive', 'Live'] },
  { domains: ['skype.com'], names: ['Microsoft', 'Skype'] },
  { domains: ['azure.com'], names: ['Microsoft', 'Azure', 'Microsoft Azure', 'Azure AD', 'Entra ID'] },
  { domains: ['dev.azure.com', 'visualstudio.com'], names: ['Microsoft', 'Azure', 'Azure DevOps', 'Visual Studio', 'Visual Studio Team Services', 'VSTS'] },
  { domains: ['minecraft.net'], names: ['Microsoft', 'Xbox', 'Minecraft', 'Mojang'] },
  { domains: ['messenger.com'], names: ['Messenger', 'Facebook'] },
  { domains: ['threads.com', 'threads.net'], names: ['Threads', 'Instagram'] },
  { domains: ['meta.com', 'oculus.com'], names: ['Meta', 'Meta Quest', 'Meta Horizon', 'Oculus'] },
  { domains: ['accounts.firefox.com'], names: ['Mozilla', 'Firefox'] },
  { domains: ['trello.com'], names: ['Atlassian', 'Trello'] },
  { domains: ['bitbucket.org'], names: ['Atlassian', 'Bitbucket'] },
  { domains: ['behance.net'], names: ['Adobe', 'Adobe ID', 'Behance'] },
  { domains: ['audible.com'], names: ['Amazon', 'Audible'] },
  { domains: ['primevideo.com'], names: ['Amazon', 'Amazon Prime', 'Prime Video'] },
  { domains: ['quickbooks.com'], names: ['Intuit', 'QuickBooks'] },
  { domains: ['turbotax.com'], names: ['Intuit', 'TurboTax'] },
  { domains: ['nordaccount.com', 'nordvpn.com', 'nordpass.com', 'nordlocker.com'], names: ['Nord', 'Nord Security', 'NordVPN', 'NordPass', 'NordLocker'] },

  // Popular sites whose common 2FA issuer differs from the web domain.
  { domains: ['openai.com', 'chatgpt.com'], names: ['OpenAI', 'ChatGPT'] },
  { domains: ['claude.ai'], names: ['Anthropic', 'Claude'] },
  { domains: ['aws.amazon.com'], names: ['AWS', 'Amazon Web Services'] },
  { domains: ['awsapps.com'], names: ['AWS', 'Amazon Web Services', 'AWS SSO', 'AWS IAM Identity Center', 'IAM Identity Center'] },
  { domains: ['battle.net', 'blizzard.com'], names: ['Battle.net', 'Blizzard', 'Blizzard Entertainment'] },
  { domains: ['playstation.com'], names: ['PlayStation', 'Sony', 'Sony Entertainment Network', 'SEN'] },
  { domains: ['steampowered.com', 'steamcommunity.com'], names: ['Steam', 'Valve'] },
  { domains: ['epicgames.com'], names: ['Epic', 'Epic Games'] },
  { domains: ['fortnite.com'], names: ['Epic Games', 'Fortnite'] },
  { domains: ['leagueoflegends.com'], names: ['Riot', 'Riot Games', 'League of Legends'] },
  { domains: ['valorant.com'], names: ['Riot', 'Riot Games', 'VALORANT'] },
  { domains: ['socialclub.rockstargames.com'], names: ['Rockstar', 'Rockstar Games', 'Rockstar Social Club', 'Social Club'] },
  { domains: ['unity.com', 'unity3d.com'], names: ['Unity', 'Unity ID', 'Unity3D'] },
  { domains: ['npmjs.com'], names: ['npm', 'npmjs', 'npm registry'] },
  { domains: ['oraclecloud.com'], names: ['Oracle', 'Oracle Cloud'] },
  { domains: ['duosecurity.com'], names: ['Duo', 'Duo Security', 'Cisco Duo'] },
  { domains: ['webex.com'], names: ['Webex', 'Cisco Webex'] },
  { domains: ['keepersecurity.com'], names: ['Keeper', 'Keeper Security'] },
  { domains: ['id.me'], names: ['ID.me'] },
  { domains: ['login.gov'], names: ['Login.gov'] },
  { domains: ['mi.com'], names: ['Mi', 'Xiaomi'] },
  { domains: ['wikipedia.org', 'wikimedia.org'], names: ['Wikipedia', 'Wikimedia'] },
  { domains: ['support.broadcom.com', 'vmware.com'], names: ['Broadcom', 'VMware', 'VMware Customer Connect'] },
  { domains: ['nytimes.com'], names: ['NYTimes', 'New York Times', 'The New York Times'] },
  { domains: ['ft.com'], names: ['FT', 'Financial Times', 'The Financial Times'] },
  { domains: ['squareup.com'], names: ['Square', 'Squareup'] }
] as const satisfies readonly SiteIdentityOverride[];
