import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: '4px', marginRight: '12px' }}>
      <button onClick={() => i18n.changeLanguage('en')} style={{ padding: '4px 8px', borderRadius: '4px', background: i18n.language.startsWith('en') ? '#333' : 'transparent', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}>EN</button>
      <button onClick={() => i18n.changeLanguage('ru')} style={{ padding: '4px 8px', borderRadius: '4px', background: i18n.language.startsWith('ru') ? '#333' : 'transparent', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}>RU</button>
    </div>
  );
};
export default LanguageSwitcher;
