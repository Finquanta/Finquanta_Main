"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { restartTour } from '@/components/user_dashboard/tour/TourGuide';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import NotificationSettingsComponent from '@/components/user_dashboard/settings/NotificationSettings';
import BillingSettings from '@/components/user_dashboard/settings/BillingSettings';
import FinnaSettings from '@/components/user_dashboard/settings/FinnaSettings';
import { NotificationSettings } from '@/components/user_dashboard/settings/types';
import { Sun, Moon } from 'lucide-react';
import { BusinessProfile, getBusinessProfile, saveBusinessProfile, uploadBusinessLogo } from '@/lib/api/business';
import DashboardShell from '@/components/user_dashboard/DashboardShell';
import { logoutAndRedirect } from '@/lib/auth';
import { DeletionBlocker, deleteAccount, getDeletionBlockers, getMe, saveMyProfile } from '@/lib/api/me';
import { BusinessMember, getMembers } from '@/lib/api/businesses';
import { COUNTRIES } from '@/lib/countries';

const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];
// Asked at signup; kept editable here. Must match the onboarding options.
const DEBT_ANSWERS = ["Yes", "No", "Not sure"];
const PRIMARY_GOALS = ["Grow revenue", "Reduce expenses", "Improve cash flow", "Get organized"];

/**
 * The sections this page actually has. Must match the nav below.
 *
 * Business Profile, Finna Overview and Billing are deliberately absent — they
 * are workspace-scoped and live in Workspace Settings now. Links to them from
 * before the split are still around, which is what this list is for.
 */
const PERSONAL_SECTIONS = [
  'profile-settings', 'notifications', 'languages', 'theme', 'feedback', 'legal', 'logout',
];

export default function ProfileSettingsPage() {
  const [activeSection, setActiveSection] = useState('profile-settings');

  /**
   * Allow another page to open this one on a particular section, e.g.
   * `/profile-settings?section=notifications`.
   *
   * CHECKED against the sections that exist. It used to accept anything, so a
   * link to a section that had moved — `?section=billing`, which the sidebar's
   * Upgrade button pointed at until Billing became workspace-scoped — selected
   * a section with nothing behind it and left the page blank. Falling back to
   * the default shows a working page rather than an empty one.
   *
   * Read from `window.location` in an effect rather than with
   * `useSearchParams`, which would drag this page into needing a Suspense
   * boundary purely to look at one optional parameter.
   */
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (section && PERSONAL_SECTIONS.includes(section)) setActiveSection(section);
  }, []);
  const [menuSearch, setMenuSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  /**
   * The personal phone — and, unlike its neighbours in this section, it is
   * actually persisted. `user_profiles.phone` is a real column, read here from
   * /v1/me and written back with an explicit Save.
   */
  const [phone, setPhone] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
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
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => { getBusinessProfile().then(setBiz).catch(() => {}); }, []);
  /**
   * Load the whole personal profile.
   *
   * Every field in this section maps to a real column and none of them were
   * ever read — Role, Company email, LinkedIn, Date of incorporation and
   * Country were `useState` and nothing else, so anything typed there vanished
   * on navigation. This is the read half of fixing that.
   */
  useEffect(() => {
    getMe().then((me) => {
      const p = me.profile ?? {};
      setPhone((p.phone as string) ?? '');
      setRole((p.jobTitle as string) ?? '');
      setCompanyEmail((p.companyEmail as string) ?? '');
      setLinkedin((p.linkedin as string) ?? '');
      setDateOfIncorporation((p.dateOfIncorporation as string) ?? '');
      setCountry((p.country as string) ?? '');
    }).catch(() => {});
  }, []);

  /**
   * One save for the whole section.
   *
   * The phone briefly had its own button, which made sense while it was the
   * only field here that persisted. Now that they all do, a section where one
   * input saves itself and five others wait for a button below would be a trap.
   */
  const saveProfile = async () => {
    setPhoneSaving(true);
    setPhoneSaved(false);
    try {
      await saveMyProfile({
        phone: phone.trim(),
        jobTitle: role.trim(),
        companyEmail: companyEmail.trim(),
        linkedin: linkedin.trim(),
        dateOfIncorporation: dateOfIncorporation.trim(),
        country: country.trim(),
      });
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setPhoneSaving(false);
    }
  };

  // Delete account — irreversible, so it's gated behind re-entering the
  // password plus a native confirm() as a second, harder-to-misclick step.
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  /**
   * Shared workspaces this account owns, and who is nominated to inherit each.
   *
   * Deleting an account cascades the businesses it owns and every ledger under
   * them. For a workspace with colleagues in it, that means one person closing
   * their account erases everybody's books — so each of these has to be handed
   * to someone before the delete button will do anything. The server refuses
   * regardless; this is so the question gets asked here rather than as an error.
   */
  const [blockers, setBlockers] = useState<DeletionBlocker[]>([]);
  const [candidates, setCandidates] = useState<Record<string, BusinessMember[]>>({});
  const [successors, setSuccessors] = useState<Record<string, string>>({});

  // Asked as soon as the delete panel opens, so the successor pickers are
  // already on screen when the password is typed.
  useEffect(() => {
    if (!deletingAccount) return;
    getDeletionBlockers()
      .then(async (list) => {
        setBlockers(list);
        const entries = await Promise.all(
          list.map(async (b) => {
            const members = await getMembers(b.id).catch(() => [] as BusinessMember[]);
            return [b.id, members.filter((m) => m.role !== 'Owner')] as const;
          })
        );
        setCandidates(Object.fromEntries(entries));
      })
      .catch(() => setBlockers([]));
  }, [deletingAccount]);

  const unnominated = blockers.filter((b) => !successors[b.id]);

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim() || deleteSubmitting) return;
    if (unnominated.length > 0) {
      setDeleteError('Choose who takes over each shared workspace first.');
      return;
    }
    const handovers = blockers.length
      ? `

${blockers.length} shared workspace${blockers.length === 1 ? '' : 's'} will be handed to the ` +
        `${blockers.length === 1 ? 'person' : 'people'} you chose, not deleted.`
      : '';
    const sure = window.confirm(
      'This permanently deletes your account AND your business’s entire financial history — invoices, bookkeeping, everything. This cannot be undone. Continue?' +
      handovers
    );
    if (!sure) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePassword.trim(), successors);
      logoutAndRedirect('/login');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account.');
      setDeleteSubmitting(false);
    }
  };

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
    <DashboardShell>
    <div className={`flex h-full ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Middle - Settings Menu */}
      <div className={`w-64 border-r flex flex-col py-6 px-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t("dashboard","settings")}</h2>
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
            /* Business Profile, Finna Overview and Billing are NOT here any
               more — they describe a workspace, not a person, and now live on
               /workspace-settings where each workspace gets its own. Adding one
               back here would give the same row two editors, and the copy under
               "your account" would again imply there is only one workspace. */
            { id: 'languages', label: t('settings', 'languageSettings') },
            { id: 'theme', label: t('settings', 'themeSettings') },
            { id: 'notifications', label: t('settings', 'notificationSettings') },
            { id: 'legal', label: 'Legal' },
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
        <div className="mt-auto px-3">
          {deletingAccount ? (
            <div className="mt-2 space-y-2">
              {/* Said before the password, not after: somebody closing an
                  account wants to stop paying, and leaving them to guess is how
                  a deletion turns into a chargeback. */}
              <p className={`text-[11px] leading-snug ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Any subscription on the workspaces you own is cancelled at the same time — you will
                not be charged again.
              </p>
              {blockers.map((b) => (
                <div key={b.id} className={`rounded-lg border p-2 ${theme === 'dark' ? 'border-amber-700 bg-amber-900/20' : 'border-amber-300 bg-amber-50'}`}>
                  <p className={`text-[11px] font-semibold ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
                    {b.name} has {b.otherMembers} other member{b.otherMembers === 1 ? '' : 's'}
                  </p>
                  <p className={`text-[11px] mb-1 ${theme === 'dark' ? 'text-amber-200/80' : 'text-amber-700'}`}>
                    Hand it over, or their books go with your account.
                  </p>
                  <select
                    value={successors[b.id] ?? ''}
                    onChange={(e) => setSuccessors((p) => ({ ...p, [b.id]: e.target.value }))}
                    className={`w-full border rounded-lg px-2 py-1.5 text-xs ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  >
                    <option value="">Choose the new owner…</option>
                    {(candidates[b.id] ?? []).map((m) => (
                      <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
                    ))}
                  </select>
                </div>
              ))}
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteAccount(); }}
                placeholder="Confirm your password"
                autoFocus
                className={`w-full border rounded-lg px-3 py-2 text-xs ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'}`}
              />
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteAccount}
                  disabled={deleteSubmitting || !deletePassword.trim() || unnominated.length > 0}
                  className={`flex-1 text-white text-xs px-4 py-2 rounded-lg disabled:opacity-60 ${theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {deleteSubmitting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  onClick={() => { setDeletingAccount(false); setDeletePassword(''); setDeleteError(null); setSuccessors({}); }}
                  className={`text-xs px-3 py-2 rounded-lg border ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >{t("dashboard","invCancel")}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeletingAccount(true)}
              className={`mt-2 w-full text-white text-xs px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {t('settings', 'deleteAccountNow')}
            </button>
          )}
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
              {/* Your own number, not the business's — that one lives under
                  Business profile. Separate fields on purpose: reaching a
                  person and reaching a company are different needs, even when
                  a sole trader answers both with the same digits. */}
              <div>
                <label className={`text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Phone number</label>
                <input
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveProfile(); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`}
                />
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Used for account security and anything urgent about your books.
                </p>
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
                  <option>Afghanistan</option><option>Albania</option><option>Algeria</option><option>Andorra</option><option>Angola</option><option>Antigua and Barbuda</option><option>Argentina</option><option>Armenia</option><option>Australia</option><option>Austria</option><option>Azerbaijan</option><option>Bahamas</option><option>Bahrain</option><option>Bangladesh</option><option>Barbados</option><option>Belarus</option><option>Belgium</option><option>Belize</option><option>Benin</option><option>Bhutan</option><option>Bolivia</option><option>Bosnia and Herzegovina</option><option>Botswana</option><option>Brazil</option><option>Brunei</option><option>Bulgaria</option><option>Burkina Faso</option><option>Burundi</option><option>Cabo Verde</option><option>Cambodia</option><option>Cameroon</option><option>Canada</option><option>Central African Republic</option><option>Chad</option><option>Chile</option><option>China</option><option>Colombia</option><option>Comoros</option><option>Congo</option><option>Costa Rica</option><option>Croatia</option><option>Cuba</option><option>Cyprus</option><option>Czech Republic</option><option>Denmark</option><option>Djibouti</option><option>Dominica</option><option>Dominican Republic</option><option>Ecuador</option><option>Egypt</option><option>El Salvador</option><option>Equatorial Guinea</option><option>Eritrea</option><option>Estonia</option><option>Eswatini</option><option>Ethiopia</option><option>Fiji</option><option>Finland</option><option>France</option><option>Gabon</option><option>Gambia</option><option>Georgia</option><option>Germany</option><option>Ghana</option><option>Greece</option><option>Grenada</option><option>Guatemala</option><option>Guinea</option><option>Guinea-Bissau</option><option>Guyana</option><option>Haiti</option><option>Honduras</option><option>Hungary</option><option>Iceland</option><option>India</option><option>Indonesia</option><option>Iran</option><option>Iraq</option><option>Ireland</option><option>Israel</option><option>Italy</option><option>Jamaica</option><option>Japan</option><option>Jordan</option><option>Kazakhstan</option><option>Kenya</option><option>Kiribati</option><option>Kuwait</option><option>Kyrgyzstan</option><option>Laos</option><option>Latvia</option><option>Lebanon</option><option>Lesotho</option><option>Liberia</option><option>Libya</option><option>Liechtenstein</option><option>Lithuania</option><option>Luxembourg</option><option>Madagascar</option><option>Malawi</option><option>Malaysia</option><option>Maldives</option><option>Mali</option><option>Malta</option><option>Marshall Islands</option><option>Mauritania</option><option>Mauritius</option><option>Mexico</option><option>Micronesia</option><option>Moldova</option><option>Monaco</option><option>Mongolia</option><option>Montenegro</option><option>Morocco</option><option>Mozambique</option><option>Myanmar</option><option>Namibia</option><option>Nauru</option><option>Nepal</option><option>Netherlands</option><option>New Zealand</option><option>Nicaragua</option><option>Niger</option><option>Nigeria</option><option>North Korea</option><option>North Macedonia</option><option>Norway</option><option>Oman</option><option>Pakistan</option><option>Palau</option><option>Palestine</option><option>Panama</option><option>Papua New Guinea</option><option>Paraguay</option><option>Peru</option><option>Philippines</option><option>Poland</option><option>Portugal</option><option>Qatar</option><option>Romania</option><option>Russia</option><option>Rwanda</option><option>Saint Kitts and Nevis</option><option>Saint Lucia</option><option>Saint Martin (French part)</option><option>Saint Vincent and the Grenadines</option><option>Samoa</option><option>San Marino</option><option>Sao Tome and Principe</option><option>Saudi Arabia</option><option>Senegal</option><option>Serbia</option><option>Seychelles</option><option>Sierra Leone</option><option>Singapore</option><option>Sint Maarten (Dutch part)</option><option>Slovakia</option><option>Slovenia</option><option>Solomon Islands</option><option>Somalia</option><option>South Africa</option><option>South Korea</option><option>South Sudan</option><option>Spain</option><option>Sri Lanka</option><option>Sudan</option><option>Suriname</option><option>Sweden</option><option>Switzerland</option><option>Syria</option><option>Taiwan</option><option>Tajikistan</option><option>Tanzania</option><option>Thailand</option><option>Timor-Leste</option><option>Togo</option><option>Tonga</option><option>Trinidad and Tobago</option><option>Tunisia</option><option>Turkey</option><option>Turkmenistan</option><option>Tuvalu</option><option>Uganda</option><option>Ukraine</option><option>United Arab Emirates</option><option>United Kingdom</option><option>United States</option><option>Uruguay</option><option>Uzbekistan</option><option>Vanuatu</option><option>Vatican City</option><option>Venezuela</option><option>Vietnam</option><option>Yemen</option><option>Zambia</option><option>Zimbabwe</option>
                </select>
              </div>
              {/* This button existed with no onClick — which is why nothing in
                  this section ever persisted. Every field above maps to a real
                  column; they were simply never sent anywhere. */}
              <button
                onClick={saveProfile}
                disabled={phoneSaving}
                className={`px-6 py-2 rounded-lg w-fit text-white font-medium disabled:opacity-60 ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}
              >
                {phoneSaving ? 'Saving…' : phoneSaved ? 'Saved' : t('settings', 'saveChanges')}
              </button>
            </div>
          </>
        )}
 
        {/* Business Profile (from onboarding — editable & saved here) */}

        {/* Product tour — the spec requires it be restartable from settings */}


        {/* Language Settings */}

        {/* Product tour — the spec requires it be restartable from settings.
            It sits under Profile now rather than Business Profile: the tour is
            a walkthrough for a PERSON, and it followed the business tab out of
            this page only because it happened to be nested inside it. */}
        {activeSection === 'profile-settings' && (
          <div className={`p-6 rounded-lg max-w-2xl mt-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t("dashboard","psProductTour")}</h2>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              A five-step walkthrough of the dashboard, bookkeeping, invoices and Finna. Takes about a minute.
            </p>
            <button
              onClick={() => { restartTour(); router.push('/dashboard'); }}
              className={`inline-flex items-center gap-2 text-white text-sm font-medium px-6 py-3 rounded-lg ${theme === 'dark' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'}`}
            >{t("dashboard","psRestartTour")}</button>
          </div>
        )}

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
 
        {/* Legal — the documents you agreed to at signup. They used to sit loose
            at the bottom of the sidebar; they belong here. */}
        {activeSection === 'legal' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t("dashboard","psLegal")}</h2>
            <p className={`text-sm mb-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t("dashboard","psLegalHint")}</p>
            <div className="flex flex-col">
              {[
                { href: '/terms', label: t('dashboard', 'termsOfService') },
                { href: '/privacy', label: t('dashboard', 'privacyPolicy') },
                { href: '/ai-risk-disclosure', label: t('dashboard', 'aiRiskDisclosure') },
              ].map((doc, i, all) => (
                <Link
                  key={doc.href}
                  href={doc.href}
                  className={`flex items-center justify-between px-1 py-3 text-sm transition-colors ${
                    i === all.length - 1 ? '' : `border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`
                  } ${theme === 'dark' ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
                >
                  {doc.label}
                  <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>›</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {activeSection === 'feedback' && (
          <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'giveFeedback')}</h2>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t("dashboard","psFeedbackHint")}</p>
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
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t("dashboard","psLogoutAsk")}</p>
            <button onClick={() => logoutAndRedirect('/login')} className={`text-white text-sm font-medium px-6 py-3 rounded-lg ${theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {t('settings', 'logOut')}
            </button>
          </div>
        )}
 
      </div>
    </div>
    </DashboardShell>
  );
}
