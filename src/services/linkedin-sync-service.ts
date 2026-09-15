import { LinkedInSelfProfile } from '../types/extension-types';

export interface LinkedInSyncResult {
  success: boolean;
  profile?: LinkedInSelfProfile;
  error?: string;
  source?: 'active_tab' | 'feed_module' | 'nav_me' | 'manual_url';
}

/**
 * Script executed inside the LinkedIn tab to extract the logged-in user's identity.
 */
function extractSelfProfileFromLinkedInDom(): LinkedInSelfProfile | null {
  try {
    // 1. Check Feed Identity Module (present on LinkedIn feed / home page)
    const feedModule = document.querySelector('.feed-identity-module');
    if (feedModule) {
      const nameEl =
        feedModule.querySelector('.feed-identity-module__actor-meta a') ||
        feedModule.querySelector('div.t-16.t-black.t-bold') ||
        feedModule.querySelector('.identity-headline + div');

      const headlineEl =
        feedModule.querySelector('.identity-headline') ||
        feedModule.querySelector('p.t-12.t-black--light');

      const linkEl = feedModule.querySelector<HTMLAnchorElement>('a[href*="/in/"]');

      const fullName = nameEl?.textContent?.trim() || '';
      const headline = headlineEl?.textContent?.trim() || '';
      const vanityUrl = linkEl?.href ? linkEl.href.split('?')[0] : '';

      if (fullName) {
        return {
          fullName,
          headline,
          currentCompany: '',
          currentRole: headline.split(' at ')[0]?.trim() || headline,
          location: '',
          vanityUrl,
          summary: ''
        };
      }
    }

    // 2. Check Global Navigation "Me" dropdown / trigger
    // Look for profile link in nav dropdown or me photo
    const meLink = document.querySelector<HTMLAnchorElement>(
      '.global-nav__me-content a[href*="/in/"], a.artdeco-dropdown__item[href*="/in/"], a[data-control-name="nav.settings_view_profile"]'
    );

    const meNameEl = document.querySelector(
      '.global-nav__me-content .artdeco-entity-lockup__title, .global-nav__me-content h3'
    );
    const meHeadlineEl = document.querySelector(
      '.global-nav__me-content .artdeco-entity-lockup__subtitle, .global-nav__me-content p'
    );

    if (meNameEl?.textContent?.trim()) {
      const fullName = meNameEl.textContent.trim();
      const headline = meHeadlineEl?.textContent?.trim() || '';
      const vanityUrl = meLink?.href ? meLink.href.split('?')[0] : '';

      return {
        fullName,
        headline,
        currentCompany: '',
        currentRole: headline.split(' at ')[0]?.trim() || headline,
        location: '',
        vanityUrl,
        summary: ''
      };
    }

    // 3. If currently on a profile page (e.g. user clicked to their own profile)
    if (window.location.pathname.includes('/in/')) {
      const topCard = document.querySelector('.pv-top-card') || document.querySelector('section.artdeco-card');
      if (topCard) {
        const nameEl = topCard.querySelector('h1');
        const headlineEl = topCard.querySelector('.text-body-medium');
        const locationEl = topCard.querySelector('.text-body-small.inline.t-black--light');

        if (nameEl?.textContent?.trim()) {
          const headline = headlineEl?.textContent?.trim() || '';
          return {
            fullName: nameEl.textContent.trim(),
            headline,
            currentCompany: '',
            currentRole: headline.split(' at ')[0]?.trim() || headline,
            location: locationEl?.textContent?.trim() || '',
            vanityUrl: window.location.href.split('?')[0],
            summary: ''
          };
        }
      }
    }

    // 4. Try reading any canonical profile vanity URL from the document
    if (meLink?.href) {
      const cleanUrl = meLink.href.split('?')[0];
      const handle = cleanUrl.split('/in/')[1]?.replace(/\/$/, '') || '';
      return {
        fullName: handle.replace(/[-_]/g, ' '),
        headline: '',
        currentCompany: '',
        currentRole: '',
        location: '',
        vanityUrl: cleanUrl,
        summary: ''
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Synchronizes the user's LinkedIn profile by querying active or open LinkedIn tabs.
 */
export async function syncLinkedInProfileFromBrowser(): Promise<LinkedInSyncResult> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return {
      success: false,
      error: 'Chrome tabs API is not available in this environment.'
    };
  }

  try {
    // 1. Find all open LinkedIn tabs
    const linkedInTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });

    if (!linkedInTabs || linkedInTabs.length === 0) {
      return {
        success: false,
        error: 'No active LinkedIn tab found. Please open LinkedIn in another tab and try again.'
      };
    }

    // Prioritize active tab if it is LinkedIn, otherwise use the first LinkedIn tab
    const targetTab = linkedInTabs.find((t) => t.active) || linkedInTabs[0];

    if (!targetTab.id) {
      return {
        success: false,
        error: 'Unable to access the LinkedIn tab.'
      };
    }

    // 2. Execute DOM extraction script inside the LinkedIn tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: extractSelfProfileFromLinkedInDom
    });

    const profileData = results?.[0]?.result as LinkedInSelfProfile | null;

    if (profileData && (profileData.fullName || profileData.vanityUrl)) {
      return {
        success: true,
        profile: profileData,
        source: 'active_tab'
      };
    }

    return {
      success: false,
      error: 'Found LinkedIn tab, but could not detect profile details. Please navigate to your LinkedIn feed or profile page and try again.'
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown synchronization error';
    return {
      success: false,
      error: `Failed to sync LinkedIn profile: ${message}`
    };
  }
}
