"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import NotificationSettingsComponent from '@/components/user_dashboard/settings/NotificationSettings';
import { NotificationSettings } from '@/components/user_dashboard/settings/types';
import { Sun, Moon } from 'lucide-react';
import { BusinessProfile, getBusinessProfile, saveBusinessProfile } from '@/lib/api/business';

const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];

export default function ProfileSettingsPage() {
  const [activeSection, setActiveSection] = useState('profile-settings');
  const [menuSearch, setMenuSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [dateOfIncorporation, setDateOfIncorporation] = useState('');
  const [country, setCountry] = useState('');
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const setThemeMode = (nextTheme: 'light' | 'dark') => {
    if (theme !== nextTheme) {
      toggleTheme();
    }
  };
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    filter: false,
    newsUpdates: false,
    reminders: false,
    pushNotifications: false,
    paymentUpdate: false,
    balanceNotification: false,
    emailNotifications: false,
    smsNotifications: false,
    inAppNotifications: true,
    frequency: 'daily'
  });

  // Business profile (the answers from onboarding) — loaded & saved here.
  const [biz, setBiz] = useState<BusinessProfile>({});
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);

  useEffect(() => { getBusinessProfile().then(setBiz).catch(() => {}); }, []);

  const setBizField = (key: keyof BusinessProfile, value: string) => setBiz((p) => ({ ...p, [key]: value }));

  const saveBiz = async () => {
    setBizSaving(true);
    setBizSaved(false);
    try {
      const updated = await saveBusinessProfile(biz);
      setBiz(updated);
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save business profile.');
    } finally {
      setBizSaving(false);
    }
  };

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Left Sidebar */}
      <div className={`w-48 border-r flex flex-col py-6 px-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="mb-8">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className={`text-sm font-semibold px-3 py-2 rounded-lg ${theme === 'dark' ? 'text-orange-400 bg-orange-900 bg-opacity-30' : 'text-orange-500 bg-orange-50'}`}>
            {t('dashboard', 'title')}
          </Link>
        </nav>
        <div className={`mt-auto flex flex-col gap-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          <Link href="/profile-settings" className={`font-medium hover:underline ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{t('dashboard', 'profileSettings')}</Link>
          <Link href="/terms" className={`hover:underline ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('dashboard', 'termsOfService')}</Link>
          <Link href="/privacy" className={`hover:underline ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('dashboard', 'privacyPolicy')}</Link>
          <Link href="/ai-risk-disclosure" className={`hover:underline ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('dashboard', 'aiRiskDisclosure')}</Link>
          <button onClick={() => router.push('/login')} className={`text-left hover:underline ${theme === 'dark' ? 'text-red-400 hover:text-red-500' : 'text-red-500 hover:text-red-600'}`}>{t('settings', 'logOut')}</button>
          <p className={`mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t('dashboard', 'version')} 1.0.0.0</p>
        </div>
      </div>
 
      {/* Middle - Settings Menu */}
      <div className={`w-64 border-r flex flex-col py-6 px-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'profileSettings')}</h2>
        <div className="relative mb-4">
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder={t('dashboard', 'search')}
            className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'}`}
          />
        </div>
        <nav className="flex flex-col gap-1">
          {[
            { id: 'profile-settings', label: t('dashboard', 'profileSettings') },
            { id: 'business-profile', label: t('settings', 'bizProfile') },
            { id: 'languages', label: t('settings', 'languageSettings') },
            { id: 'theme', label: t('settings', 'themeSettings') },
            { id: 'notifications', label: t('settings', 'notificationSettings') },
            { id: 'feedback', label: t('settings', 'giveFeedback') },
            { id: 'logout', label: t('settings', 'logOut') },
          ].filter((item) => item.label.toLowerCase().includes(menuSearch.trim().toLowerCase())).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg text-left ${
                activeSection === item.id 
                  ? theme === 'dark' ? 'bg-gray-700 font-medium text-white' : 'bg-gray-100 font-medium text-gray-900'
                  : theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              {item.label}
              <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>›</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <button className={`text-sm px-3 py-2 hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`}>{t('settings', 'deleteAccount')}</button>
          <p className={`text-xs mt-1 px-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t('settings', 'deleteAccountWarning')}</p>
          <button className={`mt-2 mx-3 text-white text-xs px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}>
            {t('settings', 'deleteAccountNow')}
          </button>
        </div>
      </div>
 
      {/* Right - Content */}
      <div className={`flex-1 flex flex-col overflow-y-auto p-8 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
 
        {/* Profile Settings */}
        {activeSection === 'profile-settings' && (
          <>
            <div className={`flex items-center gap-4 mb-8 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-300 text-gray-600'}`}>
                {firstName && lastName ? firstName[0] + lastName[0] : 'U'}
              </div>
              <div>
                <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{firstName} {lastName}</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{email}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button className={`text-white text-sm px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}>
                  {t('settings', 'changePhotoProfile')}
                </button>
                <button className={`text-sm px-4 py-2 rounded-lg border ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
                  {t('settings', 'delete')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 max-w-lg">
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'role')}</label>
                <input 
                  type="text" 
                  placeholder={t('settings', 'enterYourRole')} 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'companyName')}</label>
                <input 
                  type="text" 
                  placeholder={t('settings', 'enterCompanyName')} 
                  value={companyName} 
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'companyEmail')}</label>
                <input 
                  type="email" 
                  placeholder={t('settings', 'enterCompanyEmail')} 
                  value={companyEmail} 
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>LinkedIn</label>
                <input 
                  type="text" 
                  placeholder={t('settings', 'enterLinkedinUrl')} 
                  value={linkedin} 
                  onChange={(e) => setLinkedin(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
              </div>
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'dateOfIncorporation')}</label>
                <input 
                  type="date" 
                  value={dateOfIncorporation} 
                  onChange={(e) => setDateOfIncorporation(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'countryOfHeadquartered')}</label>
                <select 
                  value={country} 
                  onChange={(e) => setCountry(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                >
                  <option value="">{t('settings', 'selectACountry')}</option>
                  <option>Afghanistan</option><option>Albania</option><option>Algeria</option><option>Andorra</option><option>Angola</option><option>Antigua and Barbuda</option><option>Argentina</option><option>Armenia</option><option>Australia</option><option>Austria</option><option>Azerbaijan</option><option>Bahamas</option><option>Bahrain</option><option>Bangladesh</option><option>Barbados</option><option>Belarus</option><option>Belgium</option><option>Belize</option><option>Benin</option><option>Bhutan</option><option>Bolivia</option><option>Bosnia and Herzegovina</option><option>Botswana</option><option>Brazil</option><option>Brunei</option><option>Bulgaria</option><option>Burkina Faso</option><option>Burundi</option><option>Cabo Verde</option><option>Cambodia</option><option>Cameroon</option><option>Canada</option><option>Central African Republic</option><option>Chad</option><option>Chile</option><option>China</option><option>Colombia</option><option>Comoros</option><option>Congo</option><option>Costa Rica</option><option>Croatia</option><option>Cuba</option><option>Cyprus</option><option>Czech Republic</option><option>Denmark</option><option>Djibouti</option><option>Dominica</option><option>Dominican Republic</option><option>Ecuador</option><option>Egypt</option><option>El Salvador</option><option>Equatorial Guinea</option><option>Eritrea</option><option>Estonia</option><option>Eswatini</option><option>Ethiopia</option><option>Fiji</option><option>Finland</option><option>France</option><option>Gabon</option><option>Gambia</option><option>Georgia</option><option>Germany</option><option>Ghana</option><option>Greece</option><option>Grenada</option><option>Guatemala</option><option>Guinea</option><option>Guinea-Bissau</option><option>Guyana</option><option>Haiti</option><option>Honduras</option><option>Hungary</option><option>Iceland</option><option>India</option><option>Indonesia</option><option>Iran</option><option>Iraq</option><option>Ireland</option><option>Israel</option><option>Italy</option><option>Jamaica</option><option>Japan</option><option>Jordan</option><option>Kazakhstan</option><option>Kenya</option><option>Kiribati</option><option>Kuwait</option><option>Kyrgyzstan</option><option>Laos</option><option>Latvia</option><option>Lebanon</option><option>Lesotho</option><option>Liberia</option><option>Libya</option><option>Liechtenstein</option><option>Lithuania</option><option>Luxembourg</option><option>Madagascar</option><option>Malawi</option><option>Malaysia</option><option>Maldives</option><option>Mali</option><option>Malta</option><option>Marshall Islands</option><option>Mauritania</option><option>Mauritius</option><option>Mexico</option><option>Micronesia</option><option>Moldova</option><option>Monaco</option><option>Mongolia</option><option>Montenegro</option><option>Morocco</option><option>Mozambique</option><option>Myanmar</option><option>Namibia</option><option>Nauru</option><option>Nepal</option><option>Netherlands</option><option>New Zealand</option><option>Nicaragua</option><option>Niger</option><option>Nigeria</option><option>North Korea</option><option>North Macedonia</option><option>Norway</option><option>Oman</option><option>Pakistan</option><option>Palau</option><option>Palestine</option><option>Panama</option><option>Papua New Guinea</option><option>Paraguay</option><option>Peru</option><option>Philippines</option><option>Poland</option><option>Portugal</option><option>Qatar</option><option>Romania</option><option>Russia</option><option>Rwanda</option><option>Saint Kitts and Nevis</option><option>Saint Lucia</option><option>Saint Vincent and the Grenadines</option><option>Samoa</option><option>San Marino</option><option>Sao Tome and Principe</option><option>Saudi Arabia</option><option>Senegal</option><option>Serbia</option><option>Seychelles</option><option>Sierra Leone</option><option>Singapore</option><option>Slovakia</option><option>Slovenia</option><option>Solomon Islands</option><option>Somalia</option><option>South Africa</option><option>South Korea</option><option>South Sudan</option><option>Spain</option><option>Sri Lanka</option><option>Sudan</option><option>Suriname</option><option>Sweden</option><option>Switzerland</option><option>Syria</option><option>Taiwan</option><option>Tajikistan</option><option>Tanzania</option><option>Thailand</option><option>Timor-Leste</option><option>Togo</option><option>Tonga</option><option>Trinidad and Tobago</option><option>Tunisia</option><option>Turkey</option><option>Turkmenistan</option><option>Tuvalu</option><option>Uganda</option><option>Ukraine</option><option>United Arab Emirates</option><option>United Kingdom</option><option>United States</option><option>Uruguay</option><option>Uzbekistan</option><option>Vanuatu</option><option>Vatican City</option><option>Venezuela</option><option>Vietnam</option><option>Yemen</option><option>Zambia</option><option>Zimbabwe</option>
                </select>
              </div>
              <button className={`px-6 py-2 rounded-lg w-fit text-white font-medium ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}>
                {t('settings', 'saveChanges')}
              </button>
            </div>
          </>
        )}
 
        {/* Business Profile (from onboarding — editable & saved here) */}
        {activeSection === 'business-profile' && (() => {
          const inputCls = `w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`;
          const labelCls = `text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`;
          return (
            <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'bizProfile')}</h2>
              <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('settings', 'bizProfileDesc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('settings', 'fBusinessName')}</label>
                  <input className={inputCls} value={biz.businessName ?? ''} onChange={(e) => setBizField('businessName', e.target.value)} placeholder="e.g. Acme Co." />
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fBusinessType')}</label>
                  <input className={inputCls} value={biz.businessType ?? ''} onChange={(e) => setBizField('businessType', e.target.value)} placeholder="e.g. SaaS, Retail, Agency" />
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fIndustry')}</label>
                  <input className={inputCls} value={biz.industry ?? ''} onChange={(e) => setBizField('industry', e.target.value)} placeholder="e.g. Technology, Food" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('settings', 'fNiche')}</label>
                  <input className={inputCls} value={biz.niche ?? ''} onChange={(e) => setBizField('niche', e.target.value)} placeholder="e.g. vegan meal prep" />
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fStructure')}</label>
                  <select className={inputCls} value={biz.entityType ?? ''} onChange={(e) => setBizField('entityType', e.target.value)}>
                    <option value="">{t('settings', 'selectOption')}</option>
                    {ENTITY_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fCountry')}</label>
                  <input className={inputCls} value={biz.country ?? ''} onChange={(e) => setBizField('country', e.target.value)} placeholder="e.g. United States" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('settings', 'fPlaceOfIncorporation')}</label>
                  <input className={inputCls} value={biz.incorporationLocation ?? ''} onChange={(e) => setBizField('incorporationLocation', e.target.value)} placeholder="e.g. Delaware, USA" />
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fMaturityStage')}</label>
                  <select className={inputCls} value={biz.maturityStage ?? ''} onChange={(e) => setBizField('maturityStage', e.target.value)}>
                    <option value="">{t('settings', 'selectOption')}</option>
                    {MATURITY_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fRevenueRange')}</label>
                  <select className={inputCls} value={biz.revenueRange ?? ''} onChange={(e) => setBizField('revenueRange', e.target.value)}>
                    <option value="">{t('settings', 'selectOption')}</option>
                    {REVENUE_RANGES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('settings', 'fEmployees')}</label>
                  <select className={inputCls} value={biz.employeeCount ?? ''} onChange={(e) => setBizField('employeeCount', e.target.value)}>
                    <option value="">{t('settings', 'selectOption')}</option>
                    {EMPLOYEE_COUNTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('settings', 'fFinancialGoals')}</label>
                  <textarea className={`${inputCls} min-h-[80px]`} value={biz.financialGoals ?? ''} onChange={(e) => setBizField('financialGoals', e.target.value)} placeholder="e.g. Reach $20k/month, build 6-month runway" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={saveBiz} disabled={bizSaving} className={`px-6 py-2 rounded-lg text-white font-medium disabled:opacity-60 ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}>
                  {bizSaving ? t('onboarding', 'saving') : t('settings', 'saveChanges')}
                </button>
                {bizSaved && <span className="text-sm text-green-500">{t('settings', 'bizSaved')}</span>}
              </div>
            </div>
          );
        })()}

        {/* Language Settings */}
        {activeSection === 'languages' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'languageSettings')}</h2>
            <label className={`text-sm mb-2 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{t('settings', 'displayLanguage')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`w-full max-w-sm border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
            >
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="fr">🇫🇷 French</option>
              <option value="pt">🇵🇹 Portuguese</option>
              <option value="ar">🇸🇦 Arabic</option>
              <option value="zh">🇨🇳 Chinese</option>
              <option value="ja">🇯🇵 Japanese</option>
              <option value="ru">🇷🇺 Russian</option>
              <option value="nl">🇳🇱 Dutch</option>
              <option value="de">🇩🇪 German</option>
            </select>
            <p className={`text-xs mt-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('settings', 'changeLanguageAcrossSite')}</p>
          </div>
        )}
 
        {/* Theme Settings */}
        {activeSection === 'theme' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'themeSettings')}</h2>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{t('settings', 'selectAppearance')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              {/* Light Mode */}
              <button
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50'
                    : theme === 'dark' ? 'border-gray-600 bg-gray-700 hover:border-gray-500' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Sun className={`w-5 h-5 ${theme === 'light' ? 'text-blue-500' : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'}`} />
                  <span className={`font-semibold ${theme === 'light' ? 'text-blue-700' : theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('dashboard', 'light')}</span>
                </div>
                <p className={`text-sm ${theme === 'light' ? 'text-blue-600' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('settings', 'lightModeDescription')}
                </p>
              </button>
 
              {/* Dark Mode */}
              <button
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-gray-700'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-gray-900'}`}>{t('dashboard', 'dark')}</span>
                </div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('settings', 'darkModeDescription')}
                </p>
              </button>
            </div>
          </div>
        )}
 
        {/* Notification Settings */}
        {activeSection === 'notifications' && (
          <NotificationSettingsComponent
            settings={notificationSettings}
            onSettingsChange={setNotificationSettings}
          />
        )}
 
        {/* Feedback */}
        {activeSection === 'feedback' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'giveFeedback')}</h2>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              We would love to hear your thoughts on Finquanta. Click below to share your feedback!
            </p>
            <a
              href="https://airtable.com/appvpi5gHRidiIhw8/pagLtSSYVhxqHrWFk/form"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block text-white text-sm font-medium px-6 py-3 rounded-lg ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}
            >
              Give Feedback
            </a>
          </div>
        )}

        {/* Logout */}
        {activeSection === 'logout' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'logOut')}</h2>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Are you sure you want to log out?</p>
            <button onClick={() => router.push('/login')} className={`text-white text-sm font-medium px-6 py-3 rounded-lg ${theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {t('settings', 'logOut')}
            </button>
          </div>
        )}
 
      </div>
    </div>
  );
}
