"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';
import NotificationSettingsComponent from '@/components/user_dashboard/settings/NotificationSettings';

export default function ProfileSettingsPage() {
  const [activeSection, setActiveSection] = useState('profile-settings');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [dateOfIncorporation, setDateOfIncorporation] = useState('');
  const [country, setCountry] = useState('');
  const { language, setLanguage } = useLanguage();
  const [notificationSettings, setNotificationSettings] = useState({
    filter: false,
    newsUpdates: false,
    reminders: false,
    pushNotifications: false,
    paymentUpdate: false,
    balanceNotification: false
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col py-6 px-4">
        <div className="mb-8">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto" />
        </div>
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className="text-sm font-semibold text-orange-500 bg-orange-50 px-3 py-2 rounded-lg">
            Dashboard
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-xs">
          <Link href="/profile-settings" className="text-green-600 font-medium hover:underline">Profile Settings</Link>
          <Link href="/terms" className="text-gray-500 hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="text-gray-500 hover:underline">Privacy Policy</Link>
          <p className="mt-4 text-gray-400">Version 1.0.0.0</p>
        </div>
      </div>

      {/* Middle - Settings Menu */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col py-6 px-4">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <div className="relative mb-4">
          <input type="text" placeholder="search" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8" />
        </div>
        <nav className="flex flex-col gap-1">
          {[
            { id: 'profile-settings', label: 'Profile Settings' },
            { id: 'languages', label: 'Languages Settings' },
            { id: 'notifications', label: 'Notification Settings' },
            { id: 'feedback', label: 'Give Feedback' },
            { id: 'logout', label: 'Log Out' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg text-left ${
                activeSection === item.id ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              {item.label}
              <span className="text-gray-400">›</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <button className="text-sm text-red-500 px-3 py-2 hover:underline">Delete account</button>
          <p className="text-xs text-gray-400 mt-1 px-3">Closing your account can't be undone. Please make sure your account balance is $0.00 before you begin.</p>
          <button className="mt-2 mx-3 bg-red-500 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-600">
            Delete Account Now
          </button>
        </div>
      </div>

      {/* Right - Content */}
      <div className="flex-1 flex flex-col overflow-y-auto p-8">

        {/* Profile Settings */}
        {activeSection === 'profile-settings' && (
          <>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">
                  {firstName && lastName ? firstName[0] + lastName[0] : 'U'}
                </span>
              </div>
              <div>
                <p className="font-semibold">{firstName} {lastName}</p>
                <p className="text-sm text-gray-500">{email}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button className="bg-green-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-600">
                  Change Photo Profile
                </button>
                <button className="border border-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
                  Delete
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 max-w-lg">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Role</label>
                <input type="text" placeholder="Enter your role" value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Company Name</label>
                <input type="text" placeholder="Enter company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Company Email</label>
                <input type="email" placeholder="Enter company email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">LinkedIn</label>
                <input type="text" placeholder="Enter LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Date of Incorporation</label>
                <input type="date" value={dateOfIncorporation} onChange={(e) => setDateOfIncorporation(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Country of Headquartered</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100">
                  <option value="">Select a country</option>
                  <option>Afghanistan</option><option>Albania</option><option>Algeria</option><option>Andorra</option><option>Angola</option><option>Antigua and Barbuda</option><option>Argentina</option><option>Armenia</option><option>Australia</option><option>Austria</option><option>Azerbaijan</option><option>Bahamas</option><option>Bahrain</option><option>Bangladesh</option><option>Barbados</option><option>Belarus</option><option>Belgium</option><option>Belize</option><option>Benin</option><option>Bhutan</option><option>Bolivia</option><option>Bosnia and Herzegovina</option><option>Botswana</option><option>Brazil</option><option>Brunei</option><option>Bulgaria</option><option>Burkina Faso</option><option>Burundi</option><option>Cabo Verde</option><option>Cambodia</option><option>Cameroon</option><option>Canada</option><option>Central African Republic</option><option>Chad</option><option>Chile</option><option>China</option><option>Colombia</option><option>Comoros</option><option>Congo</option><option>Costa Rica</option><option>Croatia</option><option>Cuba</option><option>Cyprus</option><option>Czech Republic</option><option>Denmark</option><option>Djibouti</option><option>Dominica</option><option>Dominican Republic</option><option>Ecuador</option><option>Egypt</option><option>El Salvador</option><option>Equatorial Guinea</option><option>Eritrea</option><option>Estonia</option><option>Eswatini</option><option>Ethiopia</option><option>Fiji</option><option>Finland</option><option>France</option><option>Gabon</option><option>Gambia</option><option>Georgia</option><option>Germany</option><option>Ghana</option><option>Greece</option><option>Grenada</option><option>Guatemala</option><option>Guinea</option><option>Guinea-Bissau</option><option>Guyana</option><option>Haiti</option><option>Honduras</option><option>Hungary</option><option>Iceland</option><option>India</option><option>Indonesia</option><option>Iran</option><option>Iraq</option><option>Ireland</option><option>Israel</option><option>Italy</option><option>Jamaica</option><option>Japan</option><option>Jordan</option><option>Kazakhstan</option><option>Kenya</option><option>Kiribati</option><option>Kuwait</option><option>Kyrgyzstan</option><option>Laos</option><option>Latvia</option><option>Lebanon</option><option>Lesotho</option><option>Liberia</option><option>Libya</option><option>Liechtenstein</option><option>Lithuania</option><option>Luxembourg</option><option>Madagascar</option><option>Malawi</option><option>Malaysia</option><option>Maldives</option><option>Mali</option><option>Malta</option><option>Marshall Islands</option><option>Mauritania</option><option>Mauritius</option><option>Mexico</option><option>Micronesia</option><option>Moldova</option><option>Monaco</option><option>Mongolia</option><option>Montenegro</option><option>Morocco</option><option>Mozambique</option><option>Myanmar</option><option>Namibia</option><option>Nauru</option><option>Nepal</option><option>Netherlands</option><option>New Zealand</option><option>Nicaragua</option><option>Niger</option><option>Nigeria</option><option>North Korea</option><option>North Macedonia</option><option>Norway</option><option>Oman</option><option>Pakistan</option><option>Palau</option><option>Palestine</option><option>Panama</option><option>Papua New Guinea</option><option>Paraguay</option><option>Peru</option><option>Philippines</option><option>Poland</option><option>Portugal</option><option>Qatar</option><option>Romania</option><option>Russia</option><option>Rwanda</option><option>Saint Kitts and Nevis</option><option>Saint Lucia</option><option>Saint Vincent and the Grenadines</option><option>Samoa</option><option>San Marino</option><option>Sao Tome and Principe</option><option>Saudi Arabia</option><option>Senegal</option><option>Serbia</option><option>Seychelles</option><option>Sierra Leone</option><option>Singapore</option><option>Slovakia</option><option>Slovenia</option><option>Solomon Islands</option><option>Somalia</option><option>South Africa</option><option>South Korea</option><option>South Sudan</option><option>Spain</option><option>Sri Lanka</option><option>Sudan</option><option>Suriname</option><option>Sweden</option><option>Switzerland</option><option>Syria</option><option>Taiwan</option><option>Tajikistan</option><option>Tanzania</option><option>Thailand</option><option>Timor-Leste</option><option>Togo</option><option>Tonga</option><option>Trinidad and Tobago</option><option>Tunisia</option><option>Turkey</option><option>Turkmenistan</option><option>Tuvalu</option><option>Uganda</option><option>Ukraine</option><option>United Arab Emirates</option><option>United Kingdom</option><option>United States</option><option>Uruguay</option><option>Uzbekistan</option><option>Vanuatu</option><option>Vatican City</option><option>Venezuela</option><option>Vietnam</option><option>Yemen</option><option>Zambia</option><option>Zimbabwe</option>
                </select>
              </div>
              <button className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 w-fit">
                Save Changes
              </button>
            </div>
          </>
        )}

        {/* Language Settings */}
        {activeSection === 'languages' && (
          <>
            <h2 className="text-xl font-semibold mb-6">Language Settings</h2>
            <label className="text-sm text-gray-600 mb-2 block">Display Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100"
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
            <p className="text-xs text-gray-400 mt-3">This will change the language across the entire site.</p>
          </>
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
          <>
            <h2 className="text-xl font-semibold mb-6">Give Feedback</h2>
            <p className="text-sm text-gray-500">Feedback form coming soon.</p>
          </>
        )}

      </div>
    </div>
  );
}
