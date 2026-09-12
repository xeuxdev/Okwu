import { TargetProfileData } from '../types/extension-types';

export function extractTargetProfileFromDom(): TargetProfileData {
  const profileUrl = window.location.href;

  // Primary profile header card
  const topCard = document.querySelector('section.artdeco-card') || document.querySelector('.ph5') || document.body;

  // 1. Full name extraction with fallback selectors
  let fullName = '';
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'h1.v-align-middle',
    '.pv-top-card--list h1',
    'div.ph5 h1',
    'h1'
  ];

  for (const sel of nameSelectors) {
    const el = topCard.querySelector(sel);
    if (el && el.textContent?.trim()) {
      fullName = el.textContent.trim();
      break;
    }
  }

  // 2. Headline / Title extraction
  let headline = '';
  const headlineSelectors = [
    '.text-body-medium.break-words',
    '.pv-top-card--list-bullet .text-body-medium',
    'div[data-generated-suggestion-target]',
    '.pv-text-details__left-panel .text-body-medium'
  ];

  for (const sel of headlineSelectors) {
    const el = topCard.querySelector(sel);
    if (el && el.textContent?.trim()) {
      headline = el.textContent.trim();
      break;
    }
  }

  // 3. Current Company / Education
  let companyOrRole = '';
  const companySelectors = [
    'ul.pv-top-card--experience-list li',
    'div[aria-label="Current company"]',
    'button[aria-label*="Current company"]',
    '.pv-text-details__right-panel .text-body-small'
  ];

  for (const sel of companySelectors) {
    const el = topCard.querySelector(sel);
    if (el && el.textContent?.trim()) {
      companyOrRole = el.textContent.trim();
      break;
    }
  }

  // 4. Location
  let location = '';
  const locationSelectors = [
    '.text-body-small.inline.t-black--light.break-words',
    '.pv-top-card--list-bullet .text-body-small',
    'span.text-body-small[class*="t-black--light"]'
  ];

  for (const sel of locationSelectors) {
    const el = topCard.querySelector(sel);
    if (el && el.textContent?.trim()) {
      location = el.textContent.trim();
      break;
    }
  }

  // 5. About section excerpt
  let aboutExcerpt = '';
  const aboutSection = document.querySelector('#about') || document.querySelector('section[id*="about"]');
  if (aboutSection) {
    const parent = aboutSection.closest('section') || aboutSection;
    const textContainer = parent.querySelector('.inline-show-more-text') || parent.querySelector('.pv-shared-text-with-see-more');
    if (textContainer && textContainer.textContent) {
      aboutExcerpt = textContainer.textContent.replace(/\s+/g, ' ').replace(/see more/i, '').trim();
    }
  }

  // 6. Recent activity snippet (best-effort)
  let recentActivity = '';
  const activitySection = document.querySelector('#content_collections') || document.querySelector('section[id*="activity"]');
  if (activitySection) {
    const parent = activitySection.closest('section') || activitySection;
    const postSnippet = parent.querySelector('.feed-shared-update-v2__description') || parent.querySelector('.break-words');
    if (postSnippet && postSnippet.textContent) {
      recentActivity = postSnippet.textContent.replace(/\s+/g, ' ').trim().slice(0, 250);
    }
  }

  // Clean em dashes (Rule 9)
  fullName = fullName.replace(/[\u2014\u2013]/g, '-');
  headline = headline.replace(/[\u2014\u2013]/g, '-');
  companyOrRole = companyOrRole.replace(/[\u2014\u2013]/g, '-');
  location = location.replace(/[\u2014\u2013]/g, '-');
  aboutExcerpt = aboutExcerpt.replace(/[\u2014\u2013]/g, '-');
  recentActivity = recentActivity.replace(/[\u2014\u2013]/g, '-');

  return {
    fullName,
    headline,
    companyOrRole,
    location,
    aboutExcerpt,
    recentActivity,
    profileUrl
  };
}
