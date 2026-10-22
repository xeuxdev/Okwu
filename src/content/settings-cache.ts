import { ExtensionSettings } from '../types/extension-types';
import { getSettings } from '../services/storage-service';

let cached: ExtensionSettings | null = null;
let loading: Promise<ExtensionSettings | null> | null = null;
let listening = false;

function load(): Promise<ExtensionSettings | null> {
  if (!loading) {
    loading = getSettings()
      .then((settings) => {
        cached = settings;
        return settings;
      })
      .catch(() => null)
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/**
 * Settings for the content script, read from storage once and refreshed when they change,
 * so DOM-mutation handlers don't message the service worker on every tick.
 */
export async function getCachedSettings(): Promise<ExtensionSettings | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return null;

  if (!listening && chrome.storage?.onChanged) {
    listening = true;
    chrome.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName === 'local') cached = null;
    });
  }

  return cached || load();
}
