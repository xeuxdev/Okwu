import {
  TargetProfileData,
  TargetExperience,
  TargetEducation,
  TargetFeaturedItem,
} from '../types/extension-types';

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/…\s*more/gi, '')
    .replace(/\s*see more\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Safely decodes LinkedIn redirect URLs like:
 * https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fgithub.com%2F...
 */
function cleanRedirectUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    if (url.includes('linkedin.com/safety/go')) {
      const parsed = new URL(url);
      const target = parsed.searchParams.get('url');
      if (target) return decodeURIComponent(target);
    }
  } catch {
    // Return original url if parsing fails
  }
  return url;
}

/**
 * Finds a card section in either modern LinkedIn Flagship SDUI or legacy LinkedIn DOM.
 */
function findSection(
  cardIdentifier: string,
  headingPattern?: RegExp
): HTMLElement | null {
  // 1. Modern SDUI card IDs and component keys (e.g. id*="Topcard", id*="About", id*="Featured", id*="Activity")
  const sduiSel = `div[id*="${cardIdentifier}"], div[componentkey*="${cardIdentifier}"], section[id*="${cardIdentifier}"]`;
  const sduiCard = document.querySelector<HTMLElement>(sduiSel);
  if (sduiCard) return sduiCard;

  // 2. Legacy section with ID
  const lowerId = cardIdentifier.toLowerCase();
  const legacyIdCard = document.querySelector<HTMLElement>(
    `section#${lowerId}, #${lowerId}, section[id*="${lowerId}"]`
  );
  if (legacyIdCard) return legacyIdCard;

  // 3. Fallback: Search all sections by header text
  if (headingPattern) {
    const allSections = Array.from(document.querySelectorAll<HTMLElement>('section, div.artdeco-card'));
    for (const sec of allSections) {
      const heading = sec.querySelector('h2, h3');
      if (heading?.textContent && headingPattern.test(heading.textContent)) {
        return sec;
      }
    }
  }

  return null;
}

export function extractTargetProfileFromDom(): TargetProfileData {
  const profileUrl = window.location.href;

  // Primary profile top card (SDUI or Legacy)
  const topCard =
    findSection('Topcard') ||
    document.querySelector<HTMLElement>('section.artdeco-card') ||
    document.querySelector<HTMLElement>('.ph5') ||
    document.body;

  // ---------------------------------------------------------
  // 1. FULL NAME EXTRACTION
  // ---------------------------------------------------------
  let fullName = '';

  // SDUI Topcard heading: in SDUI, the name is an <h2> inside the Topcard lazy column
  const topCardHeadings = topCard.querySelectorAll<HTMLElement>('h1, h2');
  for (let i = 0; i < topCardHeadings.length; i++) {
    const h = topCardHeadings[i];
    // Ignore toast or banner notifications
    if (h.getAttribute('data-testid') === 'toasts-title') continue;
    const text = cleanText(h.textContent);
    // Ignore section headers like "About", "Activity", "Experience"
    if (text && !/notifications|about|activity|experience|education|featured|interests/i.test(text)) {
      fullName = text;
      break;
    }
  }

  // Fallback A: SDUI Sticky Toolbar / Profile Header
  if (!fullName) {
    const toolbarName = document.querySelector<HTMLElement>(
      'div[role="toolbar"] p.ckymff, div[aria-label][componentkey] p.ckymff'
    );
    if (toolbarName?.textContent?.trim()) {
      fullName = cleanText(toolbarName.textContent);
    }
  }

  // Fallback B: Connect button aria-label (e.g. "Invite Angel Egwaoje to connect")
  if (!fullName) {
    const connectBtn = document.querySelector<HTMLElement>(
      'a[aria-label*="to connect"], button[aria-label*="to connect"]'
    );
    if (connectBtn) {
      const label = connectBtn.getAttribute('aria-label') || '';
      const match = label.match(/invite\s+(.+?)\s+to connect/i);
      if (match && match[1]) {
        fullName = cleanText(match[1]);
      }
    }
  }

  // Fallback C: Notification bell button aria-label (e.g. "Manage notifications about Angel Egwaoje ")
  if (!fullName) {
    const bellBtn = document.querySelector<HTMLElement>(
      'a[aria-label*="Manage notifications about"], button[aria-label*="Manage notifications about"]'
    );
    if (bellBtn) {
      const label = bellBtn.getAttribute('aria-label') || '';
      const match = label.match(/about\s+(.+?)\s*$/i);
      if (match && match[1]) {
        fullName = cleanText(match[1]);
      }
    }
  }

  // Fallback D: Legacy name selectors
  if (!fullName) {
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1.v-align-middle',
      '.pv-top-card--list h1',
      'div.ph5 h1',
      'h1'
    ];
    for (const sel of nameSelectors) {
      const el = topCard.querySelector<HTMLElement>(sel);
      if (el && el.textContent?.trim()) {
        const text = cleanText(el.textContent);
        if (text && !/notifications|about/i.test(text)) {
          fullName = text;
          break;
        }
      }
    }
  }

  // Fallback E: Modal invitation text if open
  if (!fullName) {
    const modal = document.querySelector('.artdeco-modal, .send-invite');
    if (modal) {
      const modalHeader = modal.querySelector('h2, .send-invite__header');
      const modalText = modal.textContent || '';
      const inviteMatch = modalText.match(/invitation to ([^.\n\r?]+)/i);
      if (inviteMatch && inviteMatch[1]) {
        fullName = cleanText(inviteMatch[1]);
      } else if (modalHeader && modalHeader.textContent) {
        fullName = cleanText(modalHeader.textContent.replace(/invite|connect with/i, ''));
      }
    }
  }

  // Fallback F: Document Title ("Angel Egwaoje | LinkedIn")
  if (!fullName && document.title) {
    const titleClean = document.title
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*\|.*$/, '')
      .trim();
    if (titleClean && !/linkedin|feed|notifications|jobs/i.test(titleClean)) {
      fullName = cleanText(titleClean);
    }
  }

  // ---------------------------------------------------------
  // 2. HEADLINE EXTRACTION
  // ---------------------------------------------------------
  let headline = '';

  // In SDUI Topcard: Look for paragraph following the name and connection degree
  if (topCard) {
    const paragraphs = Array.from(topCard.querySelectorAll<HTMLElement>('p.ckymff, p'));
    for (const p of paragraphs) {
      const text = cleanText(p.textContent);
      // Skip degree indicators like "· 1st", "· 2nd", "· 3rd", or short labels
      if (!text || /^·?\s*[123](st|nd|rd)/i.test(text) || text.length < 5) continue;
      // Skip if it's the full name
      if (fullName && text.toLowerCase() === fullName.toLowerCase()) continue;
      // Skip connection counts like "500+ connections"
      if (/connections|mutual connections|followers/i.test(text)) continue;

      // Typical headline contains role words, bars, commas, or has reasonable length
      if (
        text.includes('|') ||
        text.includes('-') ||
        text.includes('•') ||
        text.includes('@') ||
        /engineer|developer|designer|manager|student|founder|researcher|consultant|specialist|lead|director/i.test(text) ||
        text.length > 25
      ) {
        headline = text;
        break;
      }
    }
  }

  // Fallback A: SDUI Sticky Toolbar paragraph
  if (!headline) {
    const toolbarHeadline = document.querySelector<HTMLElement>(
      'div[role="toolbar"] p:nth-of-type(2), div[aria-label][componentkey] div p:nth-of-type(2)'
    );
    if (toolbarHeadline?.textContent?.trim()) {
      headline = cleanText(toolbarHeadline.textContent);
    }
  }

  // Fallback B: Legacy headline selectors
  if (!headline) {
    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-top-card--list-bullet .text-body-medium',
      'div[data-generated-suggestion-target]',
      '.pv-text-details__left-panel .text-body-medium',
      'div[data-anonymize="headline"]'
    ];
    for (const sel of headlineSelectors) {
      const el = topCard.querySelector<HTMLElement>(sel);
      if (el && el.textContent?.trim()) {
        headline = cleanText(el.textContent);
        break;
      }
    }
  }

  // ---------------------------------------------------------
  // 3. CURRENT COMPANY / SCHOOL / ROLE IN HEADER
  // ---------------------------------------------------------
  let companyOrRole = '';

  // SDUI Topcard school / org badge (e.g. "The University of Manchester")
  const sduiOrgEl =
    topCard.querySelector<HTMLElement>('div[style*="min-width: 24rem"] p') ||
    topCard.querySelector<HTMLElement>('svg#school-accent-4')
      ?.closest('div[role="button"], div.ckyip7')
      ?.querySelector('p');

  if (sduiOrgEl && sduiOrgEl.textContent?.trim()) {
    companyOrRole = cleanText(sduiOrgEl.textContent);
  }

  // Fallback: Legacy selectors
  if (!companyOrRole) {
    const companySelectors = [
      'ul.pv-top-card--experience-list li',
      'div[aria-label="Current company"]',
      'button[aria-label*="Current company"]',
      '.pv-text-details__right-panel .text-body-small'
    ];
    for (const sel of companySelectors) {
      const el = topCard.querySelector<HTMLElement>(sel);
      if (el && el.textContent?.trim()) {
        companyOrRole = cleanText(el.textContent);
        break;
      }
    }
  }

  // ---------------------------------------------------------
  // 4. LOCATION EXTRACTION
  // ---------------------------------------------------------
  let location = '';

  // In SDUI Topcard: paragraph preceding "Contact info" link
  const contactInfoLink = topCard.querySelector<HTMLElement>('a[href*="contact-info"]');
  if (contactInfoLink) {
    const parentContainer = contactInfoLink.closest('div');
    if (parentContainer) {
      const locP = parentContainer.querySelector('p');
      if (locP && locP.textContent?.trim()) {
        location = cleanText(locP.textContent);
      }
    }
  }

  // Fallback: Legacy location selectors
  if (!location) {
    const locationSelectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-top-card--list-bullet .text-body-small',
      'span.text-body-small[class*="t-black--light"]',
      '.pv-text-details__left-panel span.text-body-small'
    ];
    for (const sel of locationSelectors) {
      const el = topCard.querySelector<HTMLElement>(sel);
      if (el && el.textContent?.trim()) {
        location = cleanText(el.textContent);
        break;
      }
    }
  }

  // ---------------------------------------------------------
  // 5. ABOUT SECTION EXCERPT
  // ---------------------------------------------------------
  let aboutExcerpt = '';
  const aboutSection = findSection('About', /about/i);

  if (aboutSection) {
    // In SDUI, the full about text is in [data-testid="expandable-text-box"]
    const sduiAboutBox = aboutSection.querySelector<HTMLElement>(
      'span[data-testid="expandable-text-box"], [data-testid="expandable-text-box"]'
    );
    if (sduiAboutBox && sduiAboutBox.textContent) {
      aboutExcerpt = cleanText(sduiAboutBox.textContent);
    } else {
      // Legacy selectors
      const textContainer =
        aboutSection.querySelector<HTMLElement>('.inline-show-more-text') ||
        aboutSection.querySelector<HTMLElement>('.pv-shared-text-with-see-more');
      if (textContainer && textContainer.textContent) {
        aboutExcerpt = cleanText(textContainer.textContent);
      }
    }
  }

  // ---------------------------------------------------------
  // 6. FEATURED ITEMS (PROJECTS, ARTICLES, PORTFOLIO)
  // ---------------------------------------------------------
  const featuredItems: TargetFeaturedItem[] = [];
  const featuredSection = findSection('Featured', /featured/i);

  if (featuredSection) {
    // Items are in listitems or carousel children
    const itemElements = Array.from(
      featuredSection.querySelectorAll<HTMLElement>(
        'li[data-testid="carousel-child-container"] div[role="listitem"], div[role="listitem"], ul.pvs-list > li'
      )
    );

    for (let i = 0; i < Math.min(itemElements.length, 4); i++) {
      const itemEl = itemElements[i];
      const linkEl = itemEl.querySelector<HTMLAnchorElement>('a[href]');
      const rawHref = linkEl?.getAttribute('href') || '';
      const cleanUrl = cleanRedirectUrl(rawHref);

      // Paragraphs inside item
      const paragraphs = Array.from(itemEl.querySelectorAll<HTMLElement>('p'));
      let itemTitle = '';
      let itemCategory = '';
      let itemDescription = '';

      if (paragraphs.length >= 1) {
        // Find title
        for (const p of paragraphs) {
          const t = cleanText(p.textContent);
          if (!t) continue;
          if (!itemCategory && /^(link|article|post|newsletter|media)$/i.test(t)) {
            itemCategory = t;
            continue;
          }
          if (!itemTitle && t.length > 3) {
            itemTitle = t;
            continue;
          }
          if (itemTitle && !itemDescription && t.length > 20) {
            itemDescription = t;
            break;
          }
        }
      }

      if (itemTitle) {
        featuredItems.push({
          title: itemTitle,
          category: itemCategory || undefined,
          description: itemDescription || undefined,
          link: cleanUrl || undefined,
        });
      }
    }
  }

  // ---------------------------------------------------------
  // 7. RECENT POST / ACTIVITY EXTRACTION
  // ---------------------------------------------------------
  let recentPost = '';
  let recentActivity = '';
  const actSection = findSection('Activity', /activity/i);

  if (actSection) {
    // In SDUI, recent posts are inside [data-testid="expandable-text-box"] in carousel items
    const sduiPostBoxes = Array.from(
      actSection.querySelectorAll<HTMLElement>('span[data-testid="expandable-text-box"]')
    );

    for (const box of sduiPostBoxes) {
      const text = cleanText(box.textContent);
      if (text && text.length > 25) {
        recentPost = text.slice(0, 450);
        recentActivity = text.slice(0, 300);
        break;
      }
    }

    // Fallback: Legacy post selectors
    if (!recentPost) {
      const postSelectors = [
        '.feed-shared-update-v2__description',
        '.feed-shared-text',
        '.update-components-text',
        '.feed-shared-inline-show-more-text',
        'div[data-view-name*="profile-card"] span.break-words',
        '.break-words'
      ];
      for (const sel of postSelectors) {
        const el = actSection.querySelector<HTMLElement>(sel);
        if (el && el.textContent?.trim()) {
          const text = cleanText(el.textContent);
          if (text.length > 20) {
            recentPost = text.slice(0, 450);
            recentActivity = text.slice(0, 300);
            break;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------
  // 8. DETAILED WORK EXPERIENCES
  // ---------------------------------------------------------
  const experiences: TargetExperience[] = [];
  const expSection = findSection('Experience', /experience/i);

  if (expSection) {
    const items = expSection.querySelectorAll<HTMLElement>(
      'ul.pvs-list > li, li.artdeco-list__item, li.pvs-list__paged-list-item, div[role="listitem"]'
    );

    for (let i = 0; i < Math.min(items.length, 4); i++) {
      const item = items[i];

      // Check if item contains multiple sub-roles at the same company
      const subRoles = item.querySelectorAll('li.pvs-list__paged-list-item');
      if (subRoles.length > 0) {
        const companyEl = item.querySelector('.t-bold span[aria-hidden="true"], h3, .t-bold');
        const company = cleanText(companyEl?.textContent);

        for (let j = 0; j < Math.min(subRoles.length, 2); j++) {
          const sub = subRoles[j];
          const titleEl = sub.querySelector('.t-bold span[aria-hidden="true"], h4, .t-bold');
          const timeEl = sub.querySelector('.t-black--light span[aria-hidden="true"], .t-black--light');
          const descEl = sub.querySelector('.inline-show-more-text span[aria-hidden="true"], [data-testid="expandable-text-box"]');

          const title = cleanText(titleEl?.textContent);
          if (title) {
            experiences.push({
              title,
              company,
              timeframe: cleanText(timeEl?.textContent),
              description: cleanText(descEl?.textContent)
            });
          }
        }
      } else {
        // Single role entry
        const titleEl =
          item.querySelector('.t-bold span[aria-hidden="true"]') ||
          item.querySelector('span.mr1.t-bold') ||
          item.querySelector('h3');
        const companyEl =
          item.querySelector('.t-normal span[aria-hidden="true"]') ||
          item.querySelector('span.t-14.t-normal') ||
          item.querySelector('h4');
        const timeEl =
          item.querySelector('.t-black--light span[aria-hidden="true"]') ||
          item.querySelector('span.pvs-entity__caption-wrapper');
        const descEl =
          item.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
          item.querySelector('.pv-shared-text-with-see-more') ||
          item.querySelector('[data-testid="expandable-text-box"]');

        const title = cleanText(titleEl?.textContent);
        const company = cleanText(companyEl?.textContent);

        if (title || company) {
          experiences.push({
            title: title || 'Specialist',
            company: company || companyOrRole,
            timeframe: cleanText(timeEl?.textContent),
            description: cleanText(descEl?.textContent)
          });
        }
      }
    }
  }

  // If companyOrRole was missing in topCard, derive from latest experience
  if (!companyOrRole && experiences.length > 0) {
    const latest = experiences[0];
    companyOrRole = latest.company ? `${latest.title} at ${latest.company}` : latest.title;
  }

  // ---------------------------------------------------------
  // 9. EDUCATION EXTRACTION
  // ---------------------------------------------------------
  const education: TargetEducation[] = [];
  const eduSection = findSection('Education', /education/i);

  if (eduSection) {
    const items = eduSection.querySelectorAll<HTMLElement>(
      'ul.pvs-list > li, li.artdeco-list__item, div[role="listitem"]'
    );

    for (let i = 0; i < Math.min(items.length, 3); i++) {
      const item = items[i];
      const schoolEl =
        item.querySelector('.t-bold span[aria-hidden="true"]') ||
        item.querySelector('h3') ||
        item.querySelector('p.ckymff');
      const degreeEl =
        item.querySelector('.t-normal span[aria-hidden="true"]') ||
        item.querySelector('h4');
      const timeEl = item.querySelector('.t-black--light span[aria-hidden="true"]');

      const school = cleanText(schoolEl?.textContent);
      const degreeDetail = cleanText(degreeEl?.textContent);

      if (school) {
        let degree = '';
        let fieldOfStudy = '';
        if (degreeDetail.includes(',')) {
          const parts = degreeDetail.split(',');
          degree = parts[0].trim();
          fieldOfStudy = parts.slice(1).join(',').trim();
        } else {
          degree = degreeDetail;
        }

        education.push({
          school,
          degree: degree || undefined,
          fieldOfStudy: fieldOfStudy || undefined,
          timeframe: cleanText(timeEl?.textContent)
        });
      }
    }
  }

  // If education was not yet in LazyColumn, but Topcard had a confirmed educational org
  // (e.g. user with school badge like "The University of Manchester")
  if (education.length === 0 && topCard) {
    const hasSchoolBadge = topCard.querySelector('svg#school-accent-4, [id*="school-accent"]');
    if (hasSchoolBadge && companyOrRole) {
      education.push({
        school: companyOrRole,
      });
    }
  }

  return {
    fullName,
    headline,
    companyOrRole,
    location,
    aboutExcerpt,
    recentActivity,
    recentPost: recentPost || undefined,
    featuredItems: featuredItems.length > 0 ? featuredItems : undefined,
    experiences: experiences.length > 0 ? experiences : undefined,
    education: education.length > 0 ? education : undefined,
    profileUrl,
  };
}
