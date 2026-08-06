'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ProfileSettings, SocialLink } from './types';
import { User, Camera, Mail, MapPin, Phone, Briefcase, Linkedin, Twitter, Github, Globe, Upload, X } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';

interface AccountProfileProps {
  settings: ProfileSettings;
  onSettingsChange: (settings: ProfileSettings) => void;
}

export default function AccountProfile({ settings, onSettingsChange }: AccountProfileProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState(settings.avatar || '');

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploadingAvatar(true);
      setTempAvatarUrl(URL.createObjectURL(file));
      setShowAvatarModal(true);
    }
  };

  const handleSaveAvatar = () => {
    if (tempAvatarUrl) {
      onSettingsChange({
        ...settings,
        avatar: tempAvatarUrl
      });
    }
    setIsUploadingAvatar(false);
    setShowAvatarModal(false);
    setTempAvatarUrl('');
  };

  const handleCancelAvatar = () => {
    setShowAvatarModal(false);
    setTempAvatarUrl('');
    setIsUploadingAvatar(false);
  };

  const handleAddSocialLink = () => {
    const newLink: SocialLink = {
      platform: 'website',
      url: 'https://example.com',
      visible: true
    };

    const updatedSettings = {
      ...settings,
      socialLinks: [...(settings.socialLinks || []), newLink]
    };

    onSettingsChange(updatedSettings);
  };

  const handleRemoveSocialLink = (index: number) => {
    const updatedSettings = {
      ...settings,
      socialLinks: settings.socialLinks?.filter((_, i) => i !== index) || []
    };

    onSettingsChange(updatedSettings);
  };

  return (
    <div className="bg-white p-6 h-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2 flex items-center gap-2">
          <User className="w-6 h-6 text-[#150578]" />{t("dashboard","spAccountProfile")}</h2>
        <p className="text-sm text-[#778da9]">{t("dashboard","spAccountProfileDesc")}</p>
      </div>

      <div className="space-y-8">
        {/* Profile Picture */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">{t("dashboard","spProfilePicture")}</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
            {settings.avatar ? (
            <Image
            src={settings.avatar}
            alt="Profile"
            width={96}
              height={96}
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-gray-200 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <button
                onClick={() => document.getElementById('avatar-upload')?.click()}
                className="px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />{t("dashboard","spChangePhoto")}</button>
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1b263b] flex items-center gap-2">
              <User className="w-5 h-5 text-[#150578]" />{t("dashboard","spBasicInfo")}</h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spFirstName")}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={settings.firstName}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      firstName: e.target.value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.firstName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spLastName")}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={settings.lastName}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      lastName: e.target.value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.lastName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spEmailAddress")}</label>
              {isEditing ? (
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      email: e.target.value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spPhoneNumber")}</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={settings.phone || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      phone: e.target.value
                    });
                  }}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.phone || 'Not set'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#150578]" />{t("dashboard","spProfessional")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spJobTitle")}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={settings.jobTitle || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      jobTitle: e.target.value
                    });
                  }}
                  placeholder={t("dashboard","spPhJobTitle")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.jobTitle || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spCompany")}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={settings.company || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      company: e.target.value
                    });
                  }}
                  placeholder="e.g., Fund Flow AI Inc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.company || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("settings","fIndustry")}</label>
              {isEditing ? (
                <select
                  value={settings.industry || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      industry: e.target.value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                >
                  <option value="">{t("dashboard","spSelectIndustry")}</option>
                  <option value="Technology">{t("dashboard","spTechnology")}</option>
                  <option value="Finance">{t("dashboard","spFinanceBanking")}</option>
                  <option value="Healthcare">{t("dashboard","spHealthcare")}</option>
                  <option value="Education">{t("dashboard","spEducation")}</option>
                  <option value="Retail">{t("dashboard","spRetail")}</option>
                  <option value="Manufacturing">{t("dashboard","spManufacturing")}</option>
                  <option value="Consulting">{t("dashboard","spConsulting")}</option>
                  <option value="Other">{t("dashboard","spOther")}</option>
                </select>
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
                  {settings.industry || 'Not set'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1b263b] mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={settings.bio || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      bio: e.target.value
                    });
                  }}
                  placeholder={t("dashboard","spTellUs")}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent resize-none"
                />
              ) : (
                <p className="px-4 py-2 bg-white border border-gray-200 rounded-lg min-h-[100px]">
                  {settings.bio || 'No bio provided'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#150578]" />{t("dashboard","spAddressInfo")}</h3>

          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spStreetAddress")}</label>
                <input
                  type="text"
                  value={settings.address?.street || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      address: {
                        street: e.target.value,
                        city: settings.address?.city || '',
                        state: settings.address?.state || '',
                        zipCode: settings.address?.zipCode || '',
                        country: settings.address?.country || ''
                      }
                    });
                  }}
                  placeholder="123 Main St"
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","invCity")}</label>
                <input
                  type="text"
                  value={settings.address?.city || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      address: {
                        street: settings.address?.street || '',
                        city: e.target.value,
                        state: settings.address?.state || '',
                        zipCode: settings.address?.zipCode || '',
                        country: settings.address?.country || ''
                      }
                    });
                  }}
                  placeholder="New York"
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spState")}</label>
                  <input
                    type="text"
                    value={settings.address?.state || ''}
                    onChange={(e) => {
                      onSettingsChange({
                        ...settings,
                        address: {
                          street: settings.address?.street || '',
                          city: settings.address?.city || '',
                          state: e.target.value,
                          zipCode: settings.address?.zipCode || '',
                          country: settings.address?.country || ''
                        }
                      });
                    }}
                    placeholder="NY"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","spZip")}</label>
                  <input
                    type="text"
                    value={settings.address?.zipCode || ''}
                    onChange={(e) => {
                      onSettingsChange({
                        ...settings,
                        address: {
                          street: settings.address?.street || '',
                          city: settings.address?.city || '',
                          state: settings.address?.state || '',
                          zipCode: e.target.value,
                          country: settings.address?.country || ''
                        }
                      });
                    }}
                    placeholder="10001"
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#1b263b] mb-2">{t("dashboard","invCountry")}</label>
                <select
                  value={settings.address?.country || ''}
                  onChange={(e) => {
                    onSettingsChange({
                      ...settings,
                      address: {
                        street: settings.address?.street || '',
                        city: settings.address?.city || '',
                        state: settings.address?.state || '',
                        zipCode: settings.address?.zipCode || '',
                        country: e.target.value
                      }
                    });
                  }}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">{t("dashboard","spSelectCountry")}</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Australia">Australia</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div>
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4">{t("dashboard","spSocialLinks")}</h3>
          <div className="space-y-4">
            {settings.socialLinks?.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm text-[#778da9] mb-4">{t("dashboard","spNoSocial")}</p>
                <button
                  onClick={handleAddSocialLink}
                  className="px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
                >{t("dashboard","spAddSocial")}</button>
              </div>
            ) : (
              <div className="space-y-3">
                {settings.socialLinks?.map((link, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {link.platform === 'linkedin' && <Linkedin className="w-5 h-5 text-blue-600" />}
                      {link.platform === 'twitter' && <Twitter className="w-5 h-5 text-blue-400" />}
                      {link.platform === 'github' && <Github className="w-5 h-5 text-gray-800" />}
                      {link.platform === 'website' && <Globe className="w-5 h-5 text-green-600" />}
                      <div>
                        <p className="font-medium text-[#1b263b] capitalize">{link.platform}</p>
                        <p className="text-sm text-[#778da9]">{link.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(link.url, '_blank')}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >{t("dashboard","spVisit")}</button>
                      <button
                        onClick={() => handleRemoveSocialLink(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4 inline" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      link.visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {link.visible ? 'Visible' : 'Hidden'}
                    </span>
                    <button
                      onClick={() => {
                        const updatedLinks = settings.socialLinks?.map((l, i) =>
                          i === index ? { ...l, visible: !link.visible } : l
                        );
                        onSettingsChange({
                          ...settings,
                          socialLinks: updatedLinks
                        });
                      }}
                      className="text-sm text-[#778da9] hover:text-[#150578]"
                    >
                      {link.visible ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#1b263b] mb-4">{t("dashboard","spUpdatePicture")}</h3>
            <div className="flex justify-center mb-4">
            <Image
            src={tempAvatarUrl}
            alt="Preview"
            width={128}
              height={128}
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancelAvatar}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >{t("dashboard","invCancel")}</button>
              <button
                onClick={handleSaveAvatar}
                className="flex-1 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
              >{t("dashboard","spSavePhoto")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}