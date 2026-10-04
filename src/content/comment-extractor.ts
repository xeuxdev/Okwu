import { PostContext, ExistingComment } from '../types/extension-types';

function cleanText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a container element has actual post content outside of the comment section.
 */
function hasEnclosingPostText(container: HTMLElement, commentBoxElement: HTMLElement): boolean {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-testid="expandable-text-box"], [data-sdui-anchor-id*="commentary"], .feed-shared-update-v2__description, .update-components-text, .feed-shared-text'
    )
  );

  for (const c of candidates) {
    // Exclude anything inside a comment item or inside the comment editor itself
    if (
      !c.closest('[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item') &&
      !commentBoxElement.contains(c)
    ) {
      const text = cleanText(c.textContent);
      if (text.length > 20) return true;
    }
  }

  return false;
}

/**
 * Ascends from a comment box element to locate the genuine enclosing LinkedIn post/update container.
 */
export function findPostContainer(commentBoxElement: HTMLElement): HTMLElement | null {
  const highLevelCardSelectors = [
    'div[componentkey^="expanded"]',
    'div[id^="expanded"]',
    'div[componentkey^="update-card-focus"]',
    'div[role="listitem"][componentkey*="update-card"]',
    'div[role="listitem"]',
    '.feed-shared-update-v2',
    'div[data-urn*="urn:li:activity"]',
    'div[data-id*="urn:li:activity"]',
    'article'
  ];

  // 1. Walk up the parent hierarchy until we find a container that houses genuine post text
  let current: HTMLElement | null = commentBoxElement.parentElement;
  let candidatePostContainer: HTMLElement | null = null;

  while (current && current !== document.body) {
    const id = current.id || '';
    const key = current.getAttribute('componentkey') || '';

    // Ignore sub-containers within the comment box area
    const isCommentBoxInternal =
      id.includes('CommentBox') ||
      id.includes('commentButtonSection') ||
      id.includes('commentBoxLinkPreview') ||
      id.includes('replaceableCommentTools') ||
      key.includes('commentBoxLinkPreview') ||
      key.includes('commentButtonSection') ||
      key.includes('replaceableCommentTools');

    if (!isCommentBoxInternal && hasEnclosingPostText(current, commentBoxElement)) {
      candidatePostContainer = current;

      // If this ancestor is also a high-level post card, return it immediately
      for (const sel of highLevelCardSelectors) {
        if (current.matches(sel)) {
          return current;
        }
      }
    }

    current = current.parentElement;
  }

  if (candidatePostContainer) {
    // Find the highest enclosing card wrapper above candidatePostContainer if one exists
    for (const sel of highLevelCardSelectors) {
      const enclosing = candidatePostContainer.closest<HTMLElement>(sel);
      if (enclosing && hasEnclosingPostText(enclosing, commentBoxElement)) {
        return enclosing;
      }
    }
    return candidatePostContainer;
  }

  // 2. Fallback: Parse SDUI update key from comment box ID
  // e.g. "commentBoxLinkPreview-EgsIgIDKxKzYrcDQAQ-_ZQSmCr70vf-4JIXcVSJz9cr29W6_GYOsbGEyr3jFhYFeedType_MAIN_FEED_RELEVANCE"
  const sduiEl = commentBoxElement.closest<HTMLElement>('[id*="FeedType"], [componentkey*="FeedType"]');
  const sduiKey = sduiEl?.id || sduiEl?.getAttribute('componentkey') || '';
  const match = sduiKey.match(/([a-zA-Z0-9_-]{12,}FeedType[a-zA-Z0-9_-]*)/);

  if (match) {
    const targetKey = match[1];
    const foundCard = document.querySelector<HTMLElement>(
      `[id*="${targetKey}"][id^="expanded"], [componentkey*="${targetKey}"][componentkey^="expanded"], [componentkey*="${targetKey}"][componentkey^="update-card-focus"]`
    );
    if (foundCard && hasEnclosingPostText(foundCard, commentBoxElement)) {
      return foundCard;
    }
  }

  return null;
}

/**
 * Checks whether a comment editor element is currently empty.
 */
export function isCommentEditorEmpty(editor: HTMLElement): boolean {
  const text = (editor.textContent || '').trim();
  if (text.length === 0) return true;

  // Check if it only has placeholder text or trailing br
  if (editor.querySelector('.is-editor-empty') || editor.classList.contains('is-editor-empty')) {
    return true;
  }

  // Tiptap placeholder check
  const placeholder = editor.querySelector('p[data-placeholder]')?.getAttribute('data-placeholder');
  if (placeholder && text === placeholder.trim()) {
    return true;
  }

  return false;
}

/**
 * Extracts clean text from an element while preserving paragraph and line breaks.
 */
function extractCleanText(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      'button, [data-testid="expandable-text-button"], .ckyfq2, .see-more'
    )
    .forEach((el) => el.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('p, div, li').forEach((block) => block.append('\n'));
  const text = clone.textContent || '';
  return text
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Extracts comprehensive post context, author details, body text, and existing comments.
 */
export function extractPostContext(postContainer: HTMLElement): PostContext {
  // 1. Post Author Name & Headline
  let postAuthorName = '';
  let postAuthorHeadline = '';
  let postAuthorProfileUrl = '';

  // Look for dedicated Actor containers first (strictly avoiding social headers)
  // Sort so outer primary actor comes before any nested reshared actor
  const actorContainers = Array.from(
    postContainer.querySelectorAll<HTMLElement>(
      '.update-components-actor, .feed-shared-actor, [data-testid*="actor"], .ckyl75, div[class*="actor"]'
    )
  )
    .filter((el) => {
      return !el.closest(
        '[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item, [id*="asyncInlineCommentBox"], .update-components-header, .feed-shared-header, [data-testid*="header"]'
      );
    })
    .sort((a, b) => {
      const aIsNested = Boolean(
        a.closest(
          '.feed-shared-reshare, .feed-shared-mini-update-v2, [data-testid*="reshare"], div[class*="reshare"]'
        )
      );
      const bIsNested = Boolean(
        b.closest(
          '.feed-shared-reshare, .feed-shared-mini-update-v2, [data-testid*="reshare"], div[class*="reshare"]'
        )
      );
      if (aIsNested === bIsNested) return 0;
      return aIsNested ? 1 : -1;
    });

  for (const actorEl of actorContainers) {
    const actorText = actorEl.textContent || '';
    // Skip if this container contains social proof like "Followed by", "likes this"
    if (/\b(followed by|likes this|commented on|reposted this|suggested for you)\b/i.test(actorText)) {
      continue;
    }

    const nameEl =
      actorEl.querySelector<HTMLElement>(
        '.update-components-actor__name, .feed-shared-actor__name, p.ckymff span, a[href*="/in/"] strong, a[href*="/in/"] span[aria-hidden="true"], strong'
      ) || actorEl.querySelector<HTMLElement>('a[href*="/in/"]');

    const rawName = cleanText(nameEl?.textContent).replace(/•.*$/, '').trim();
    if (rawName && rawName.length > 2 && !/^(follow|followed|1st|2nd|3rd|\d+[hdwmy])$/i.test(rawName)) {
      postAuthorName = rawName;
      const link = actorEl.querySelector<HTMLAnchorElement>('a[href*="/in/"]');
      if (link) postAuthorProfileUrl = link.href;

      const headlineEl =
        actorEl.querySelector<HTMLElement>(
          '.update-components-actor__description, .feed-shared-actor__description, p.ckymff.ckymeg span, p.ckymeg span'
        ) || actorEl.querySelectorAll('p')[1];

      if (headlineEl) {
        const headlineText = cleanText(headlineEl.textContent);
        if (headlineText && !/^\d+[hdwmy]$/i.test(headlineText)) {
          postAuthorHeadline = headlineText;
        }
      }
      break;
    }
  }

  // Fallback: search links outside of social headers, comments, and the post body itself
  if (!postAuthorName) {
    const authorLinks = Array.from(
      postContainer.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')
    ).sort((a, b) => {
      const aIsNested = Boolean(
        a.closest(
          '.feed-shared-reshare, .feed-shared-mini-update-v2, [data-testid*="reshare"], div[class*="reshare"]'
        )
      );
      const bIsNested = Boolean(
        b.closest(
          '.feed-shared-reshare, .feed-shared-mini-update-v2, [data-testid*="reshare"], div[class*="reshare"]'
        )
      );
      if (aIsNested === bIsNested) return 0;
      return aIsNested ? 1 : -1;
    });

    for (const link of authorLinks) {
      if (
        link.closest(
          '[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item, .update-components-header, .feed-shared-header, [data-testid*="header"], [data-sdui-anchor-id*="commentary"], [data-testid="expandable-text-box"], .feed-shared-update-v2__description, .update-components-text'
        )
      ) {
        continue;
      }

      const parentText = link.closest('p, div')?.textContent || '';
      if (
        /\b(followed by|following|follows|commented|reposted|celebrates|likes|supports|loves|reacted|promoted|suggested|sponsored)\b/i.test(parentText)
      ) {
        continue;
      }

      const nameEl =
        link.querySelector('p.ckymff span, strong span, .update-components-actor__name, span[aria-hidden="true"]') ||
        link.querySelector('strong') ||
        link;

      const rawName = cleanText(nameEl?.textContent).replace(/•.*$/, '').trim();
      if (rawName && rawName.length > 2 && !/^(follow|followed|1st|2nd|3rd|\d+[hdwmy])$/i.test(rawName)) {
        postAuthorName = rawName;
        postAuthorProfileUrl = link.href;
        break;
      }
    }
  }

  // 2. Post Body Text Extraction
  let postText = '';

  // Look for primary commentary containers outside comments and actor header
  const primaryCommentaryEls = Array.from(
    postContainer.querySelectorAll<HTMLElement>(
      '[data-sdui-anchor-id*="commentary"], .feed-shared-update-v2__description, .update-components-text, [data-testid="expandable-text-box"], .feed-shared-inline-show-more-text'
    )
  ).filter((el) => {
    return !el.closest(
      '[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item, [id*="asyncInlineCommentBox"], .update-components-header, .feed-shared-header, .update-components-actor, .feed-shared-actor'
    );
  });

  for (const el of primaryCommentaryEls) {
    const text = extractCleanText(el);
    if (text.length > postText.length) {
      postText = text;
    }
  }

  // Fallback for older layouts
  if (!postText || postText.length < 20) {
    const fallbackEls = Array.from(
      postContainer.querySelectorAll<HTMLElement>('.feed-shared-text, .update-components-text-view')
    ).filter((el) => {
      return !el.closest(
        '[id^="replaceableComment_"], [data-testid*="commentList"], .comments-comment-item, [id*="asyncInlineCommentBox"]'
      );
    });
    for (const el of fallbackEls) {
      const text = extractCleanText(el);
      if (text.length > postText.length) {
        postText = text;
      }
    }
  }

  // 3. Existing Comments Extraction (Top 3-4 comments for cliché avoidance)
  const existingComments: ExistingComment[] = [];

  const sduiCommentEls = Array.from(
    postContainer.querySelectorAll<HTMLElement>('[id^="replaceableComment_"], [componentkey^="CommentComponentReference_"]')
  );

  for (const commentEl of sduiCommentEls.slice(0, 4)) {
    const authorEl = commentEl.querySelector('p.ckymff.ckymeh span, a[href*="/in/"]');
    const textEl = commentEl.querySelector('[data-testid="expandable-text-box"], p.ckymff.ckymeh span');

    const author = cleanText(authorEl?.textContent).replace(/•.*$/, '').trim();
    const text = cleanText(textEl?.textContent);

    if (text && text.length > 2) {
      existingComments.push({
        author: author || 'Commenter',
        text
      });
    }
  }

  // Classic comments fallback
  if (existingComments.length === 0) {
    const classicComments = Array.from(
      postContainer.querySelectorAll<HTMLElement>('.comments-comment-item, .comments-comments-list__comment-item')
    );
    for (const commentEl of classicComments.slice(0, 4)) {
      const authorEl = commentEl.querySelector('.comments-post-meta__name-text, .comments-comment-meta__description-title');
      const textEl = commentEl.querySelector('.comments-comment-item__main-content, .feed-shared-main-content--comment');
      const author = cleanText(authorEl?.textContent);
      const text = cleanText(textEl?.textContent);
      if (text) {
        existingComments.push({
          author: author || 'Commenter',
          text
        });
      }
    }
  }

  const postUrn =
    postContainer.getAttribute('data-urn') ||
    postContainer.getAttribute('data-id') ||
    postContainer.getAttribute('componentkey') ||
    postContainer.id ||
    undefined;

  return {
    postAuthorName: postAuthorName || 'Post Author',
    postAuthorHeadline: postAuthorHeadline || undefined,
    postAuthorProfileUrl: postAuthorProfileUrl || undefined,
    postText: postText,
    existingComments: existingComments.length > 0 ? existingComments : undefined,
    postUrn
  };
}
