import { useCallback, useEffect, useState } from 'react';
import {
  PLAIN_KEY_STORAGE,
  clearStoredKeys,
  hasEncryptedKeyStored,
  loadEncryptedKey,
  saveEncryptedKey,
} from '../utils/crypto';

export function useApiKey() {
  const [apiKey, setApiKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    setHasEncryptedKey(hasEncryptedKeyStored());
    const legacy = localStorage.getItem(PLAIN_KEY_STORAGE);
    if (legacy && !hasEncryptedKeyStored()) {
      setApiKey(legacy);
      setIsUnlocked(true);
    }
  }, []);

  const saveKey = useCallback(async (key: string, pass: string) => {
    setApiKey(key);
    if (pass && key) {
      await saveEncryptedKey(key, pass);
      setHasEncryptedKey(true);
      setIsUnlocked(true);
      setPassphrase('');
      alert('Key encrypted and saved locally. Remember your passphrase to unlock on future sessions.');
    } else if (key) {
      localStorage.removeItem(ENC_KEY_STORAGE);
      localStorage.setItem(PLAIN_KEY_STORAGE, key);
      setHasEncryptedKey(false);
      alert('Saved without encryption (legacy). Enter passphrase next time to encrypt.');
    } else {
      await saveEncryptedKey('', '');
      setHasEncryptedKey(false);
      setIsUnlocked(false);
    }
  }, []);

  const unlock = useCallback(async (pass: string) => {
    const k = await loadEncryptedKey(pass);
    if (k) {
      setApiKey(k);
      setIsUnlocked(true);
      setPassphrase('');
      return true;
    }
    alert('Unlock failed. Check passphrase.');
    return false;
  }, []);

  const clearKeys = useCallback(() => {
    clearStoredKeys();
    setApiKey('');
    setHasEncryptedKey(false);
    setIsUnlocked(false);
    setPassphrase('');
  }, []);

  return {
    apiKey,
    setApiKey,
    passphrase,
    setPassphrase,
    hasEncryptedKey,
    isUnlocked,
    saveKey,
    unlock,
    clearKeys,
  };
}