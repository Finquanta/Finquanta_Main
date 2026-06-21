"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const translations: Record<string, Record<string, Record<string, string>>> = {
  en: {
    nav: { features: "Features", faqs: "FAQs", newsletter: "Newsletter", community: "Community", blog: "Blog", scheduleDemo: "Schedule Demo", signUp: "Sign Up", login: "Login" },
    hero: { title: "Transform Your Finances with AI Power!", description: "Revolutionize your finances with our AI-powered app. Effortlessly track expenses, optimize investments, and reach your goals all in one place.", subscribe: "Subscribe now", emailPlaceholder: "Enter your email", notice: "Sign up to Finquanta AI newsletter for all the latest news, trends and insights from our industry experts." },
    features: { banner: "Optimizing financial decisions through powerful AI technology.", title: "Our AI assistant focuses on what matters most", tagline: "delivering smart financial strategies for your business.", maturity: "Maturity", maturityDesc: "Smart strategies for every stage, from startup to growth.", nature: "Nature", natureDesc: "Industry-specific insights to help you make better decisions.", niche: "Niche", nicheDesc: "Financial guidance based on your business model and operations.", financialHealth: "Financial Health", financialHealthDesc: "Stay on top of your business cash flow, expenses, and profits." },
    faq: { title: "Frequently Asked Questions", q1: "How much does Finquanta AI cost?", a1: "We offer a free plan with essential tools, plus paid plans starting at $49.99/month.", q2: "How does Finquanta AI work?", a2: "Our AI analyzes your business finances and provides smart recommendations.", q3: "What are the benefits of using Finquanta AI?", a3: "Save time, make smarter financial decisions, and get AI-powered insights." },
    newsletter: { title: "Stay in the know", description: "Sign up to Finquanta AI newsletter for all the latest news, trends and insights from our industry experts.", emailPlaceholder: "Enter your email", subscribe: "Subscribe now" },
    community: { title: "You can also connect with us on" },
    footer: { terms: "terms of service", privacy: "privacy notice", aiRisk: "ai risk disclosure" },
    legal: { returnHome: "Return to Home Page", termsTitle: "FINQUANTA TERMS OF SERVICE", termsIntro: "These Terms of Service govern your access to and use of the Finquanta platform. By creating an account or using the platform, you agree to be bound by these terms.", privacyTitle: "FINQUANTA PRIVACY NOTE", privacyIntro: "Finquanta is committed to protecting the privacy and security of the business and financial information entrusted to us by our users.", aiRiskTitle: "FINQUANTA AI RISK DISCLOSURE", aiRiskIntro: "Finquanta uses artificial intelligence, machine learning models, and automated systems to help businesses manage financial data, automate bookkeeping processes, and generate financial insights." },
    auth: { login: "Login", signUp: "Sign Up", email: "Email", password: "Password", confirmPassword: "Confirm Password", forgotPassword: "Forgot Password?", rememberMe: "Remember Me", loginButton: "Login", signUpButton: "Create Account", alreadyHaveAccount: "Already have an account?", dontHaveAccount: "Don't have an account?", loginWithGoogle: "Login with Google", signUpWithGoogle: "Sign Up with Google", resetPassword: "Reset your password", resetPasswordDesc: "Enter your email and we'll send you a reset link.", sendResetLink: "Send Reset Link", backToSignIn: "Back to Sign In", checkEmail: "Check your email", resetLinkSent: "We sent a password reset link to" },
    dashboard: { title: "Dashboard", profileSettings: "Profile Settings", termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", aiRiskDisclosure: "AI Risk Disclosure", search: "Search", balance: "Balance", cashflow: "Cashflow", expense: "Expense", bookkeeping: "Bookkeeping", last30Days: "Last 30 days", addData: "Add Data", date: "Date", type: "Type", detail: "Detail", price: "Price", amount: "Amount", noTransactions: "No transactions yet", totalRevenue: "Total Revenue", noDataYet: "No data yet", goals: "Goals", addGoal: "Add Goal", noGoalsAdded: "No goals added yet", bankAccount: "Bank account", light: "Light", dark: "Dark", version: "Version" },
    notifications: {
      title: "Notifications",
      markAllRead: "Mark all read",
      noNotifications: "No notifications",
      welcomeTitle: "Welcome to Finquanta!",
      welcomeBody: "Your account is set up and ready to use. We're glad to have you on board.",
      welcomeTime: "Just now",
      betaTitle: "We're in Beta!",
      betaBody: "Some features may be limited or change. Help us improve — submit your feedback!",
      betaTime: "Just now",
    },
    cta: { title: "Start saving today!", description: "Experience the future of finance management today with Finquanta AI", button: "Sign up now" },
    settings: {
      languageSettings: "Language Settings", displayLanguage: "Display Language", changeLanguageAcrossSite: "This will change the language across the entire site.", notificationSettings: "Notification Settings", selectNotificationPreference: "Select your notification preference", giveFeedback: "Give Feedback", logOut: "Log Out", deleteAccount: "Delete account", deleteAccountWarning: "Closing your account can't be undone. Please make sure your account balance is $0.00 before you begin.", deleteAccountNow: "Delete Account Now", languageRegion: "Language & Region", configureLanguageSettings: "Configure your preferred language, timezone, and regional settings", timeZone: "Time Zone", selectTimezone: "Select timezone", currentTime: "Current time:", dateFormat: "Date Format", today: "Today:", timeFormat: "Time Format", twelveHour: "12-hour (AM/PM)", twentyFourHour: "24-hour", currency: "Currency", example: "Example:", measurementSystem: "Measurement System", metric: "Metric (kg, cm, L)", imperial: "Imperial (lbs, ft, gal)", numberFormat: "Number Format", regionalPreferences: "Regional Preferences", regionSettingsDescription: "These settings help customize your experience based on your location and preferences.", weekStartsOn: "Week starts on:", newsAndUpdates: "News and Updates", newsAboutProducts: "News about product and feature updates.", reminders: "Reminders", getRemindersDescription: "Get a notification to remind you of updates you might have missed.", pushNotifications: "Push Notifications", pushNotificationsDescription: "Get in-app notification about your savings and investments.", changePhotoProfile: "Change Photo Profile", delete: "Delete", save: "Save", saveChanges: "Save Changes", role: "Role", enterYourRole: "Enter your role", companyName: "Company Name", enterCompanyName: "Enter company name", companyEmail: "Company Email", enterCompanyEmail: "Enter company email", linkedin: "LinkedIn", enterLinkedinUrl: "Enter LinkedIn URL", dateOfIncorporation: "Date of Incorporation", countryOfHeadquartered: "Country of Headquartered", selectACountry: "Select a country", feedbackComingSoon: "Feedback form coming soon.", themeSettings: "Theme Settings", selectAppearance: "Choose your preferred appearance", lightModeDescription: "Light theme for daytime use", darkModeDescription: "Dark theme to reduce eye strain",
      feedbackPopupTitle: "We Value Your Input!",
      feedbackPopupDesc: "Help us improve Finquanta AI. Share your thoughts with our team!",
      feedbackPopupButton: "Submit Feedback",
    }
  },
  nl: {
    nav: { features: "Functies", faqs: "Veelgestelde vragen", newsletter: "Nieuwsbrief", community: "Gemeenschap", blog: "Blog", scheduleDemo: "Demo plannen", signUp: "Registreren", login: "Inloggen" },
    hero: { title: "Transformeer je financien met AI-kracht!", description: "Revolutioneer je financien met onze AI-app.", subscribe: "Abonneer nu", emailPlaceholder: "Voer uw e-mail in", notice: "Abonneer u op de Finquanta AI-nieuwsbrief voor het laatste nieuws." },
    features: { banner: "Optimaliseer financiele beslissingen met krachtige AI-technologie.", title: "Onze AI-assistent richt zich op wat het meest belangrijk is", tagline: "slimme financiele strategieen voor uw bedrijf.", maturity: "Volwassenheid", maturityDesc: "Slimme strategieen voor elk stadium.", nature: "Aard", natureDesc: "Branchespecifieke inzichten.", niche: "Niche", nicheDesc: "Financiele begeleiding op basis van uw bedrijfsmodel.", financialHealth: "Financiele gezondheid", financialHealthDesc: "Blijf op de hoogte van uw cashflow, uitgaven en winst." },
    faq: { title: "Veelgestelde vragen", q1: "Hoeveel kost Finquanta AI?", a1: "We bieden een gratis plan en betaalde abonnementen.", q2: "Hoe werkt Finquanta AI?", a2: "Onze AI analyseert uw financien en geeft slimme aanbevelingen.", q3: "Wat zijn de voordelen van Finquanta AI?", a3: "Bespaar tijd en neem slimmere financiele beslissingen." },
    newsletter: { title: "Blijf op de hoogte", description: "Abonneer u op de Finquanta AI-nieuwsbrief.", emailPlaceholder: "Voer uw e-mail in", subscribe: "Abonneer nu" },
    community: { title: "U kunt ons ook bereiken op" },
    footer: { terms: "servicevoorwaarden", privacy: "privacykennisgeving", aiRisk: "AI-risico-openbaring" },
    legal: { returnHome: "Terug naar startpagina", termsTitle: "FINQUANTA SERVICEVOORWAARDEN", termsIntro: "Deze servicevoorwaarden beheren uw toegang tot en gebruik van het Finquanta-platform.", privacyTitle: "FINQUANTA PRIVACYKENNISGEVING", privacyIntro: "Finquanta zet zich in voor het beschermen van de privacy van financiele informatie.", aiRiskTitle: "FINQUANTA AI-RISICO-OPENBARING", aiRiskIntro: "Finquanta maakt gebruik van kunstmatige intelligentie voor financieel beheer." },
    auth: { login: "Inloggen", signUp: "Registreren", email: "E-mail", password: "Wachtwoord", confirmPassword: "Wachtwoord bevestigen", forgotPassword: "Wachtwoord vergeten?", rememberMe: "Onthoud mij", loginButton: "Inloggen", signUpButton: "Account aanmaken", alreadyHaveAccount: "Heeft u al een account?", dontHaveAccount: "Geen account?", loginWithGoogle: "Inloggen met Google", signUpWithGoogle: "Registreren met Google", resetPassword: "Wachtwoord opnieuw instellen", resetPasswordDesc: "Voer uw e-mail in en we sturen u een resetlink.", sendResetLink: "Resetlink verzenden", backToSignIn: "Terug naar inloggen", checkEmail: "Controleer uw e-mail", resetLinkSent: "We hebben een resetlink gestuurd naar" },
    dashboard: { title: "Dashboard", profileSettings: "Profielinstellingen", termsOfService: "Servicevoorwaarden", privacyPolicy: "Privacybeleid", aiRiskDisclosure: "AI-risico-openbaring", search: "Zoeken", balance: "Saldo", cashflow: "Cashflow", expense: "Uitgaven", bookkeeping: "Boekhouding", last30Days: "Afgelopen 30 dagen", addData: "Gegevens toevoegen", date: "Datum", type: "Type", detail: "Detail", price: "Prijs", amount: "Bedrag", noTransactions: "Nog geen transacties", totalRevenue: "Totale opbrengst", noDataYet: "Nog geen gegevens", goals: "Doelen", addGoal: "Doel toevoegen", noGoalsAdded: "Nog geen doelen toegevoegd", bankAccount: "Bankrekening", light: "Licht", dark: "Donker", version: "Versie" },
    notifications: {
      title: "Meldingen",
      markAllRead: "Alles als gelezen markeren",
      noNotifications: "Geen meldingen",
      welcomeTitle: "Welkom bij Finquanta!",
      welcomeBody: "Uw account is ingesteld en klaar voor gebruik. We zijn blij u aan boord te hebben.",
      welcomeTime: "Zojuist",
      betaTitle: "We zijn in bèta!",
      betaBody: "Sommige functies zijn mogelijk beperkt of kunnen veranderen. Help ons verbeteren — stuur uw feedback!",
      betaTime: "Zojuist",
    },
    cta: { title: "Begin vandaag met sparen!", description: "Ervaar de toekomst van financieel beheer met Finquanta AI", button: "Nu registreren" },
    settings: {
      languageSettings: "Taalinstellingen", displayLanguage: "Weergavetaal", changeLanguageAcrossSite: "Dit zal de taal op de hele site veranderen.", notificationSettings: "Meldingsinstellingen", selectNotificationPreference: "Selecteer uw meldingsvoorkeur", giveFeedback: "Feedback geven", logOut: "Afmelden", deleteAccount: "Account verwijderen", deleteAccountWarning: "Het sluiten van uw account kan niet ongedaan worden gemaakt.", deleteAccountNow: "Account nu verwijderen", languageRegion: "Taal en regio", configureLanguageSettings: "Configureer uw voorkeurstaal", timeZone: "Tijdzone", selectTimezone: "Selecteer tijdzone", currentTime: "Huidige tijd:", dateFormat: "Datumformat", today: "Vandaag:", timeFormat: "Tijdformat", twelveHour: "12 uur (AM/PM)", twentyFourHour: "24 uur", currency: "Valuta", example: "Voorbeeld:", measurementSystem: "Meetsysteem", metric: "Metriek (kg, cm, L)", imperial: "Imperiaal (lbs, ft, gal)", numberFormat: "Getalformat", regionalPreferences: "Regionale voorkeuren", regionSettingsDescription: "Deze instellingen helpen uw ervaring aan te passen.", weekStartsOn: "Week begint op:", newsAndUpdates: "Nieuws en updates", newsAboutProducts: "Nieuws over product- en functieupdates.", reminders: "Herinneringen", getRemindersDescription: "Ontvang een melding om u te herinneren aan updates.", pushNotifications: "Pushberichten", pushNotificationsDescription: "Ontvang een melding in de app over uw besparingen.", changePhotoProfile: "Profielfoto wijzigen", delete: "Verwijderen", save: "Opslaan", saveChanges: "Wijzigingen opslaan", role: "Rol", enterYourRole: "Voer uw rol in", companyName: "Bedrijfsnaam", enterCompanyName: "Voer bedrijfsnaam in", companyEmail: "Bedrijfse-mail", enterCompanyEmail: "Voer bedrijfse-mail in", linkedin: "LinkedIn", enterLinkedinUrl: "Voer LinkedIn-URL in", dateOfIncorporation: "Oprichtingsdatum", countryOfHeadquartered: "Land van zetelvestiging", selectACountry: "Selecteer een land", feedbackComingSoon: "Feedbackformulier binnenkort beschikbaar.", themeSettings: "Thema-instellingen", selectAppearance: "Selecteer uw voorkeuruiterlijk", lightModeDescription: "Licht thema voor dagtijds gebruik", darkModeDescription: "Donker thema om oogvermoeidheid te verminderen",
      feedbackPopupTitle: "Uw mening is belangrijk!",
      feedbackPopupDesc: "Help ons Finquanta AI te verbeteren. Deel uw gedachten met ons team!",
      feedbackPopupButton: "Feedback verzenden",
    }
  },
  de: {
    nav: { features: "Funktionen", faqs: "Haufig gestellte Fragen", newsletter: "Newsletter", community: "Gemeinschaft", blog: "Blog", scheduleDemo: "Demo planen", signUp: "Anmelden", login: "Einloggen" },
    hero: { title: "Transformieren Sie Ihre Finanzen mit KI-Kraft!", description: "Revolutionieren Sie Ihre Finanzen mit unserer KI-App.", subscribe: "Jetzt abonnieren", emailPlaceholder: "Geben Sie Ihre E-Mail ein", notice: "Abonnieren Sie den Finquanta AI-Newsletter fur die neuesten Nachrichten." },
    features: { banner: "Optimieren Sie finanzielle Entscheidungen mit leistungsstarker KI-Technologie.", title: "Unser KI-Assistent konzentriert sich auf das Wichtigste", tagline: "intelligente Finanzstrategien fur Ihr Unternehmen.", maturity: "Reife", maturityDesc: "Intelligente Strategien fur jede Phase.", nature: "Natur", natureDesc: "Branchenspezifische Erkenntnisse.", niche: "Nische", nicheDesc: "Finanzielle Anleitung basierend auf Ihrem Geschaftsmodell.", financialHealth: "Finanzielle Gesundheit", financialHealthDesc: "Behalten Sie Ihren Cashflow, Ausgaben und Gewinn im Auge." },
    faq: { title: "Haufig gestellte Fragen", q1: "Wie viel kostet Finquanta AI?", a1: "Wir bieten einen kostenlosen Plan und bezahlte Abonnements.", q2: "Wie funktioniert Finquanta AI?", a2: "Unsere KI analysiert Ihre Finanzen und gibt intelligente Empfehlungen.", q3: "Was sind die Vorteile von Finquanta AI?", a3: "Sparen Sie Zeit und treffen Sie intelligentere finanzielle Entscheidungen." },
    newsletter: { title: "Bleiben Sie auf dem Laufenden", description: "Abonnieren Sie den Finquanta AI-Newsletter.", emailPlaceholder: "Geben Sie Ihre E-Mail ein", subscribe: "Jetzt abonnieren" },
    community: { title: "Sie konnen uns auch auf erreichen" },
    footer: { terms: "Servicebedingungen", privacy: "Datenschutzerklarung", aiRisk: "KI-Risiko-Offenlegung" },
    legal: { returnHome: "Zur Startseite", termsTitle: "FINQUANTA SERVICEBEDINGUNGEN", termsIntro: "Diese Servicebedingungen regeln Ihren Zugriff auf die Finquanta-Plattform.", privacyTitle: "FINQUANTA DATENSCHUTZERKLARUNG", privacyIntro: "Finquanta setzt sich dafur ein, die Privatsphare von Finanzinformationen zu schutzen.", aiRiskTitle: "FINQUANTA KI-RISIKO-OFFENLEGUNG", aiRiskIntro: "Finquanta verwendet kunstliche Intelligenz zur Verwaltung von Finanzdaten." },
    auth: { login: "Einloggen", signUp: "Registrieren", email: "Email", password: "Passwort", confirmPassword: "Passwort bestatigen", forgotPassword: "Passwort vergessen?", rememberMe: "Merken Sie mich", loginButton: "Einloggen", signUpButton: "Konto erstellen", alreadyHaveAccount: "Sie haben bereits ein Konto?", dontHaveAccount: "Sie haben kein Konto?", loginWithGoogle: "Mit Google anmelden", signUpWithGoogle: "Mit Google registrieren", resetPassword: "Passwort zurucksetzen", resetPasswordDesc: "Geben Sie Ihre E-Mail ein und wir senden Ihnen einen Reset-Link.", sendResetLink: "Reset-Link senden", backToSignIn: "Zuruck zur Anmeldung", checkEmail: "Uberprufen Sie Ihre E-Mail", resetLinkSent: "Wir haben einen Passwort-Reset-Link gesendet an" },
    dashboard: { title: "Dashboard", profileSettings: "Profileinstellungen", termsOfService: "Servicebedingungen", privacyPolicy: "Datenschutzrichtlinie", aiRiskDisclosure: "KI-Risiko-Offenlegung", search: "Suchen", balance: "Kontostand", cashflow: "Cashflow", expense: "Ausgabe", bookkeeping: "Buchhaltung", last30Days: "Letzte 30 Tage", addData: "Daten hinzufugen", date: "Datum", type: "Typ", detail: "Detail", price: "Preis", amount: "Betrag", noTransactions: "Noch keine Transaktionen", totalRevenue: "Gesamtumsatz", noDataYet: "Noch keine Daten", goals: "Ziele", addGoal: "Ziel hinzufugen", noGoalsAdded: "Noch keine Ziele hinzugefugt", bankAccount: "Bankkonto", light: "Hell", dark: "Dunkel", version: "Version" },
    notifications: {
      title: "Benachrichtigungen",
      markAllRead: "Alle als gelesen markieren",
      noNotifications: "Keine Benachrichtigungen",
      welcomeTitle: "Willkommen bei Finquanta!",
      welcomeBody: "Ihr Konto ist eingerichtet und einsatzbereit. Wir freuen uns, Sie dabei zu haben.",
      welcomeTime: "Gerade eben",
      betaTitle: "Wir sind in der Beta-Phase!",
      betaBody: "Einige Funktionen sind moglicherweise eingeschrankt oder konnen sich andern. Helfen Sie uns zu verbessern — senden Sie Ihr Feedback!",
      betaTime: "Gerade eben",
    },
    cta: { title: "Fangen Sie heute an zu sparen!", description: "Erleben Sie die Zukunft des Finanzmanagements mit Finquanta AI", button: "Jetzt registrieren" },
    settings: {
      languageSettings: "Spracheinstellungen", displayLanguage: "Anzeigesprache", changeLanguageAcrossSite: "Dies andert die Sprache auf der gesamten Website.", notificationSettings: "Benachrichtigungseinstellungen", selectNotificationPreference: "Wahlen Sie Ihre Benachrichtigungspraferenz", giveFeedback: "Feedback geben", logOut: "Abmelden", deleteAccount: "Konto loschen", deleteAccountWarning: "Das Schliessen Ihres Kontos kann nicht ruckgangig gemacht werden.", deleteAccountNow: "Konto jetzt loschen", languageRegion: "Sprache und Region", configureLanguageSettings: "Konfigurieren Sie Ihre bevorzugte Sprache", timeZone: "Zeitzone", selectTimezone: "Zeitzone wahlen", currentTime: "Aktuelle Zeit:", dateFormat: "Datumsformat", today: "Heute:", timeFormat: "Zeitformat", twelveHour: "12 Stunden (AM/PM)", twentyFourHour: "24 Stunden", currency: "Wahrung", example: "Beispiel:", measurementSystem: "Messsystem", metric: "Metrisch (kg, cm, L)", imperial: "Imperial (lbs, ft, gal)", numberFormat: "Zahlenformat", regionalPreferences: "Regionale Einstellungen", regionSettingsDescription: "Diese Einstellungen helfen, Ihr Erlebnis anzupassen.", weekStartsOn: "Woche beginnt am:", newsAndUpdates: "Nachrichten und Updates", newsAboutProducts: "Nachrichten zu Produkt- und Featureupdates.", reminders: "Erinnerungen", getRemindersDescription: "Erhalten Sie eine Benachrichtigung fur verpasste Updates.", pushNotifications: "Push-Benachrichtigungen", pushNotificationsDescription: "Erhalten Sie In-App-Benachrichtigungen.", changePhotoProfile: "Profilfoto andern", delete: "Loschen", save: "Speichern", saveChanges: "Anderungen speichern", role: "Rolle", enterYourRole: "Geben Sie Ihre Rolle ein", companyName: "Unternehmensname", enterCompanyName: "Unternehmensname eingeben", companyEmail: "Unternehmens-E-Mail", enterCompanyEmail: "Unternehmens-E-Mail eingeben", linkedin: "LinkedIn", enterLinkedinUrl: "LinkedIn-URL eingeben", dateOfIncorporation: "Grundungsdatum", countryOfHeadquartered: "Firmensitz", selectACountry: "Wahlen Sie ein Land", feedbackComingSoon: "Feedbackformular kommt in Kurze.", themeSettings: "Designeinstellungen", selectAppearance: "Wahlen Sie Ihr bevorzugtes Aussehen", lightModeDescription: "Helles Design fur die Verwendung bei Tageslicht", darkModeDescription: "Dunkles Design zur Verringerung der Augenbelastung",
      feedbackPopupTitle: "Ihre Meinung zahlt!",
      feedbackPopupDesc: "Helfen Sie uns, Finquanta AI zu verbessern. Teilen Sie Ihre Gedanken mit unserem Team!",
      feedbackPopupButton: "Feedback senden",
    }
  },
  fr: {
    nav: { features: "Fonctionnalites", faqs: "FAQ", newsletter: "Newsletter", community: "Communaute", blog: "Blog", scheduleDemo: "Planifier une demo", signUp: "S inscrire", login: "Connexion" },
    hero: { title: "Transformez vos finances avec la puissance de l IA!", description: "Revolutionnez vos finances avec notre application alimentee par l IA.", subscribe: "S abonner", emailPlaceholder: "Entrez votre email", notice: "Inscrivez-vous a la newsletter Finquanta AI pour les dernieres nouvelles." },
    features: { banner: "Optimiser les decisions financieres grace a la puissante technologie IA.", title: "Notre assistant IA se concentre sur ce qui compte le plus", tagline: "fournir des strategies financieres intelligentes pour votre entreprise.", maturity: "Maturite", maturityDesc: "Des strategies intelligentes pour chaque etape.", nature: "Nature", natureDesc: "Des informations specifiques a l industrie.", niche: "Niche", nicheDesc: "Conseils financiers bases sur votre modele d entreprise.", financialHealth: "Sante Financiere", financialHealthDesc: "Gardez le controle de vos flux de tresorerie, depenses et benefices." },
    faq: { title: "Questions Frequemment Posees", q1: "Combien coute Finquanta AI?", a1: "Nous offrons un plan gratuit et des plans payants.", q2: "Comment fonctionne Finquanta AI?", a2: "Notre IA analyse vos finances et fournit des recommandations intelligentes.", q3: "Quels sont les avantages de Finquanta AI?", a3: "Gagnez du temps et prenez de meilleures decisions financieres." },
    newsletter: { title: "Restez informe", description: "Inscrivez-vous a la newsletter Finquanta AI.", emailPlaceholder: "Entrez votre email", subscribe: "S abonner" },
    community: { title: "Vous pouvez egalement nous rejoindre sur" },
    footer: { terms: "conditions d utilisation", privacy: "avis de confidentialite", aiRisk: "divulgation des risques IA" },
    legal: { returnHome: "Retour a la page d accueil", termsTitle: "CONDITIONS D UTILISATION DE FINQUANTA", termsIntro: "Ces conditions d utilisation regissent votre acces et votre utilisation de la plateforme Finquanta.", privacyTitle: "AVIS DE CONFIDENTIALITE DE FINQUANTA", privacyIntro: "Finquanta s engage a proteger la confidentialite des informations financieres.", aiRiskTitle: "DIVULGATION DES RISQUES IA DE FINQUANTA", aiRiskIntro: "Finquanta utilise l intelligence artificielle pour aider les entreprises a gerer les donnees financieres." },
    auth: { login: "Connexion", signUp: "S inscrire", email: "Email", password: "Mot de passe", confirmPassword: "Confirmer le mot de passe", forgotPassword: "Mot de passe oublie?", rememberMe: "Se souvenir de moi", loginButton: "Connexion", signUpButton: "Creer un compte", alreadyHaveAccount: "Vous avez deja un compte?", dontHaveAccount: "Vous n avez pas de compte?", loginWithGoogle: "Connexion avec Google", signUpWithGoogle: "S inscrire avec Google", resetPassword: "Reinitialiser votre mot de passe", resetPasswordDesc: "Entrez votre email et nous vous enverrons un lien de reinitialisation.", sendResetLink: "Envoyer le lien de reinitialisation", backToSignIn: "Retour a la connexion", checkEmail: "Verifiez votre email", resetLinkSent: "Nous avons envoye un lien de reinitialisation a" },
    dashboard: { title: "Tableau de bord", profileSettings: "Parametres de profil", termsOfService: "Conditions de service", privacyPolicy: "Politique de confidentialite", aiRiskDisclosure: "Divulgation des risques IA", search: "Rechercher", balance: "Solde", cashflow: "Tresorerie", expense: "Depense", bookkeeping: "Comptabilite", last30Days: "30 derniers jours", addData: "Ajouter des donnees", date: "Date", type: "Type", detail: "Detail", price: "Prix", amount: "Montant", noTransactions: "Aucune transaction pour l instant", totalRevenue: "Revenu total", noDataYet: "Pas de donnees pour l instant", goals: "Objectifs", addGoal: "Ajouter un objectif", noGoalsAdded: "Aucun objectif ajoute pour l instant", bankAccount: "Compte bancaire", light: "Clair", dark: "Sombre", version: "Version" },
    notifications: {
      title: "Notifications",
      markAllRead: "Tout marquer comme lu",
      noNotifications: "Aucune notification",
      welcomeTitle: "Bienvenue chez Finquanta!",
      welcomeBody: "Votre compte est configure et pret a l emploi. Nous sommes ravis de vous accueillir.",
      welcomeTime: "A l instant",
      betaTitle: "Nous sommes en beta!",
      betaBody: "Certaines fonctionnalites peuvent etre limitees ou changer. Aidez-nous a nous ameliorer — soumettez vos commentaires!",
      betaTime: "A l instant",
    },
    cta: { title: "Commencez a economiser aujourd hui!", description: "Decouvrez l avenir de la gestion financiere avec Finquanta AI", button: "S inscrire maintenant" },
    settings: {
      languageSettings: "Parametres de langue", displayLanguage: "Langue d affichage", changeLanguageAcrossSite: "Cela modifiera la langue sur l ensemble du site.", notificationSettings: "Parametres de notification", selectNotificationPreference: "Selectionnez votre preference de notification", giveFeedback: "Donner un avis", logOut: "Se deconnecter", deleteAccount: "Supprimer le compte", deleteAccountWarning: "La fermeture de votre compte ne peut pas etre annulee.", deleteAccountNow: "Supprimer le compte maintenant", languageRegion: "Langue et region", configureLanguageSettings: "Configurez votre langue preferee", timeZone: "Fuseau horaire", selectTimezone: "Selectionnez un fuseau horaire", currentTime: "Heure actuelle:", dateFormat: "Format de date", today: "Aujourd hui:", timeFormat: "Format d heure", twelveHour: "12 heures (AM/PM)", twentyFourHour: "24 heures", currency: "Devise", example: "Exemple:", measurementSystem: "Systeme de mesure", metric: "Metrique (kg, cm, L)", imperial: "Imperial (lbs, ft, gal)", numberFormat: "Format numerique", regionalPreferences: "Preferences regionales", regionSettingsDescription: "Ces parametres aident a personnaliser votre experience.", weekStartsOn: "La semaine commence le:", newsAndUpdates: "Actualites et mises a jour", newsAboutProducts: "Actualites sur les mises a jour de produits.", reminders: "Rappels", getRemindersDescription: "Recevez une notification pour les mises a jour manquees.", pushNotifications: "Notifications push", pushNotificationsDescription: "Recevez des notifications dans l application.", changePhotoProfile: "Changer la photo de profil", delete: "Supprimer", save: "Enregistrer", saveChanges: "Enregistrer les modifications", role: "Role", enterYourRole: "Entrez votre role", companyName: "Nom de l entreprise", enterCompanyName: "Entrez le nom de l entreprise", companyEmail: "Email de l entreprise", enterCompanyEmail: "Entrez l email de l entreprise", linkedin: "LinkedIn", enterLinkedinUrl: "Entrez l URL LinkedIn", dateOfIncorporation: "Date de constitution", countryOfHeadquartered: "Pays du siege social", selectACountry: "Selectionnez un pays", feedbackComingSoon: "Formulaire de retour d information bientot disponible.", themeSettings: "Parametres de theme", selectAppearance: "Choisissez votre apparence preferee", lightModeDescription: "Theme clair pour une utilisation en journee", darkModeDescription: "Theme sombre pour reduire la fatigue oculaire",
      feedbackPopupTitle: "Votre avis compte!",
      feedbackPopupDesc: "Aidez-nous a ameliorer Finquanta AI. Partagez vos pensees avec notre equipe!",
      feedbackPopupButton: "Soumettre un avis",
    }
  },
  es: {
    nav: { features: "Caracteristicas", faqs: "Preguntas frecuentes", newsletter: "Boletin", community: "Comunidad", blog: "Blog", scheduleDemo: "Programar Demo", signUp: "Registrarse", login: "Iniciar sesion" },
    hero: { title: "Transforma tus Finanzas con el Poder de la IA!", description: "Revoluciona tus finanzas con nuestra aplicacion impulsada por IA.", subscribe: "Suscribirse", emailPlaceholder: "Ingresa tu correo", notice: "Suscribete al boletin de Finquanta AI para las ultimas noticias." },
    features: { banner: "Optimizando decisiones financieras con tecnologia de IA.", title: "Nuestro asistente de IA se enfoca en lo que mas importa", tagline: "entregando estrategias financieras inteligentes para tu negocio.", maturity: "Madurez", maturityDesc: "Estrategias inteligentes para cada etapa.", nature: "Naturaleza", natureDesc: "Perspectivas especificas de la industria.", niche: "Nicho", nicheDesc: "Orientacion financiera basada en tu modelo de negocio.", financialHealth: "Salud Financiera", financialHealthDesc: "Mantente al tanto del flujo de caja, gastos y ganancias." },
    faq: { title: "Preguntas Frecuentes", q1: "Cuanto cuesta Finquanta AI?", a1: "Ofrecemos un plan gratuito y planes de pago.", q2: "Como funciona Finquanta AI?", a2: "Nuestra IA analiza las finanzas de tu negocio.", q3: "Cuales son los beneficios de usar Finquanta AI?", a3: "Ahorra tiempo y toma decisiones financieras mas inteligentes." },
    newsletter: { title: "Mantente informado", description: "Suscribete al boletin de Finquanta AI.", emailPlaceholder: "Ingresa tu correo", subscribe: "Suscribirse" },
    community: { title: "Tambien puedes conectarte con nosotros en" },
    footer: { terms: "terminos de servicio", privacy: "aviso de privacidad", aiRisk: "divulgacion de riesgo de IA" },
    legal: { returnHome: "Volver a la pagina principal", termsTitle: "TERMINOS DE SERVICIO DE FINQUANTA", termsIntro: "Estos Terminos de Servicio rigen su acceso y uso de la plataforma Finquanta.", privacyTitle: "AVISO DE PRIVACIDAD DE FINQUANTA", privacyIntro: "Finquanta se compromete a proteger la privacidad de la informacion financiera.", aiRiskTitle: "DIVULGACION DE RIESGO DE IA DE FINQUANTA", aiRiskIntro: "Finquanta utiliza inteligencia artificial para ayudar a las empresas." },
    auth: { login: "Iniciar sesion", signUp: "Registrarse", email: "Correo electronico", password: "Contrasena", confirmPassword: "Confirmar contrasena", forgotPassword: "Olvido su contrasena?", rememberMe: "Recuerdame", loginButton: "Iniciar sesion", signUpButton: "Crear cuenta", alreadyHaveAccount: "Ya tiene una cuenta?", dontHaveAccount: "No tiene una cuenta?", loginWithGoogle: "Iniciar sesion con Google", signUpWithGoogle: "Registrarse con Google", resetPassword: "Restablecer tu contrasena", resetPasswordDesc: "Ingresa tu correo y te enviaremos un enlace.", sendResetLink: "Enviar enlace", backToSignIn: "Volver a iniciar sesion", checkEmail: "Revisa tu correo", resetLinkSent: "Enviamos un enlace a" },
    dashboard: { title: "Panel de control", profileSettings: "Configuracion de perfil", termsOfService: "Terminos de servicio", privacyPolicy: "Politica de privacidad", aiRiskDisclosure: "Divulgacion de riesgo de IA", search: "Buscar", balance: "Saldo", cashflow: "Flujo de efectivo", expense: "Gasto", bookkeeping: "Contabilidad", last30Days: "Ultimos 30 dias", addData: "Agregar datos", date: "Fecha", type: "Tipo", detail: "Detalle", price: "Precio", amount: "Cantidad", noTransactions: "Sin transacciones aun", totalRevenue: "Ingresos totales", noDataYet: "Sin datos aun", goals: "Objetivos", addGoal: "Agregar objetivo", noGoalsAdded: "Sin objetivos anadidos aun", bankAccount: "Cuenta bancaria", light: "Claro", dark: "Oscuro", version: "Version" },
    notifications: {
      title: "Notificaciones",
      markAllRead: "Marcar todo como leido",
      noNotifications: "Sin notificaciones",
      welcomeTitle: "Bienvenido a Finquanta!",
      welcomeBody: "Tu cuenta esta configurada y lista para usar. Nos alegra tenerte a bordo.",
      welcomeTime: "Ahora mismo",
      betaTitle: "Estamos en beta!",
      betaBody: "Algunas funciones pueden estar limitadas o cambiar. Ayudanos a mejorar — envia tus comentarios!",
      betaTime: "Ahora mismo",
    },
    cta: { title: "Empieza a ahorrar hoy!", description: "Experimenta el futuro de la gestion financiera con Finquanta AI", button: "Registrate ahora" },
    settings: {
      languageSettings: "Configuracion de idioma", displayLanguage: "Idioma de pantalla", changeLanguageAcrossSite: "Esto cambiara el idioma en todo el sitio.", notificationSettings: "Configuracion de notificaciones", selectNotificationPreference: "Selecciona tu preferencia de notificaciones", giveFeedback: "Dar retroalimentacion", logOut: "Cerrar sesion", deleteAccount: "Eliminar cuenta", deleteAccountWarning: "Cerrar tu cuenta no se puede deshacer.", deleteAccountNow: "Eliminar cuenta ahora", languageRegion: "Idioma y region", configureLanguageSettings: "Configura tu idioma preferido", timeZone: "Zona horaria", selectTimezone: "Selecciona zona horaria", currentTime: "Hora actual:", dateFormat: "Formato de fecha", today: "Hoy:", timeFormat: "Formato de hora", twelveHour: "12 horas (AM/PM)", twentyFourHour: "24 horas", currency: "Moneda", example: "Ejemplo:", measurementSystem: "Sistema de medicion", metric: "Metrico (kg, cm, L)", imperial: "Imperial (lbs, ft, gal)", numberFormat: "Formato numerico", regionalPreferences: "Preferencias regionales", regionSettingsDescription: "Esta configuracion ayuda a personalizar tu experiencia.", weekStartsOn: "La semana comienza el:", newsAndUpdates: "Noticias y actualizaciones", newsAboutProducts: "Noticias sobre actualizaciones de productos.", reminders: "Recordatorios", getRemindersDescription: "Recibe una notificacion para recordarte actualizaciones.", pushNotifications: "Notificaciones push", pushNotificationsDescription: "Recibe notificaciones en la aplicacion.", changePhotoProfile: "Cambiar foto de perfil", delete: "Eliminar", save: "Guardar", saveChanges: "Guardar cambios", role: "Rol", enterYourRole: "Ingresa tu rol", companyName: "Nombre de empresa", enterCompanyName: "Ingresa el nombre de la empresa", companyEmail: "Correo de empresa", enterCompanyEmail: "Ingresa el correo de la empresa", linkedin: "LinkedIn", enterLinkedinUrl: "Ingresa la URL de LinkedIn", dateOfIncorporation: "Fecha de constitucion", countryOfHeadquartered: "Pais de headquarters", selectACountry: "Selecciona un pais", feedbackComingSoon: "Formulario de retroalimentacion proximamente.", themeSettings: "Configuracion de tema", selectAppearance: "Elige tu apariencia preferida", lightModeDescription: "Tema claro para uso diurno", darkModeDescription: "Tema oscuro para reducir la fatiga visual",
      feedbackPopupTitle: "Valoramos tu opinion!",
      feedbackPopupDesc: "Ayudanos a mejorar Finquanta AI. Comparte tus pensamientos con nuestro equipo!",
      feedbackPopupButton: "Enviar comentarios",
    }
  },
  pt: {
    nav: { features: "Recursos", faqs: "Perguntas frequentes", newsletter: "Newsletter", community: "Comunidade", blog: "Blog", scheduleDemo: "Agendar Demo", signUp: "Cadastrar", login: "Entrar" },
    hero: { title: "Transforme suas Financas com o Poder da IA!", description: "Revolucione suas financas com nosso aplicativo de IA.", subscribe: "Inscrever-se", emailPlaceholder: "Digite seu email", notice: "Inscreva-se na newsletter da Finquanta AI para as ultimas noticias." },
    features: { banner: "Otimizando decisoes financeiras com tecnologia de IA.", title: "Nosso assistente de IA foca no que mais importa", tagline: "entregando estrategias financeiras inteligentes para o seu negocio.", maturity: "Maturidade", maturityDesc: "Estrategias inteligentes para cada etapa.", nature: "Natureza", natureDesc: "Insights especificos do setor.", niche: "Nicho", nicheDesc: "Orientacao financeira baseada no seu modelo de negocio.", financialHealth: "Saude Financeira", financialHealthDesc: "Fique por dentro do fluxo de caixa, despesas e lucros." },
    faq: { title: "Perguntas Frequentes", q1: "Quanto custa o Finquanta AI?", a1: "Oferecemos um plano gratuito e planos pagos.", q2: "Como funciona o Finquanta AI?", a2: "Nossa IA analisa as financas do seu negocio.", q3: "Quais sao os beneficios do Finquanta AI?", a3: "Economize tempo e tome decisoes financeiras mais inteligentes." },
    newsletter: { title: "Fique por dentro", description: "Inscreva-se na newsletter da Finquanta AI.", emailPlaceholder: "Digite seu email", subscribe: "Inscrever-se" },
    community: { title: "Voce tambem pode se conectar conosco em" },
    footer: { terms: "termos de servico", privacy: "aviso de privacidade", aiRisk: "divulgacao de risco de IA" },
    legal: { returnHome: "Voltar para a pagina inicial", termsTitle: "TERMOS DE SERVICO DA FINQUANTA", termsIntro: "Estes Termos de Servico regem o seu acesso e uso da plataforma Finquanta.", privacyTitle: "AVISO DE PRIVACIDADE DA FINQUANTA", privacyIntro: "A Finquanta esta comprometida em proteger a privacidade das informacoes financeiras.", aiRiskTitle: "DIVULGACAO DE RISCO DE IA DA FINQUANTA", aiRiskIntro: "A Finquanta utiliza inteligencia artificial para ajudar empresas." },
    auth: { login: "Entrar", signUp: "Cadastrar", email: "Email", password: "Senha", confirmPassword: "Confirmar senha", forgotPassword: "Esqueceu a senha?", rememberMe: "Lembrar-me", loginButton: "Entrar", signUpButton: "Criar conta", alreadyHaveAccount: "Ja tem uma conta?", dontHaveAccount: "Nao tem uma conta?", loginWithGoogle: "Entrar com Google", signUpWithGoogle: "Cadastrar com Google", resetPassword: "Redefinir sua senha", resetPasswordDesc: "Digite seu email e enviaremos um link.", sendResetLink: "Enviar link", backToSignIn: "Voltar para entrar", checkEmail: "Verifique seu email", resetLinkSent: "Enviamos um link para" },
    dashboard: { title: "Painel de controle", profileSettings: "Configuracoes de perfil", termsOfService: "Termos de servico", privacyPolicy: "Politica de privacidade", aiRiskDisclosure: "Divulgacao de risco de IA", search: "Pesquisar", balance: "Saldo", cashflow: "Fluxo de caixa", expense: "Despesa", bookkeeping: "Contabilidade", last30Days: "Ultimos 30 dias", addData: "Adicionar dados", date: "Data", type: "Tipo", detail: "Detalhe", price: "Preco", amount: "Quantidade", noTransactions: "Sem transacoes ainda", totalRevenue: "Receita total", noDataYet: "Sem dados ainda", goals: "Metas", addGoal: "Adicionar meta", noGoalsAdded: "Nenhuma meta adicionada ainda", bankAccount: "Conta bancaria", light: "Claro", dark: "Escuro", version: "Versao" },
    notifications: {
      title: "Notificacoes",
      markAllRead: "Marcar tudo como lido",
      noNotifications: "Sem notificacoes",
      welcomeTitle: "Bem-vindo ao Finquanta!",
      welcomeBody: "Sua conta esta configurada e pronta para uso. Estamos felizes em tê-lo a bordo.",
      welcomeTime: "Agora mesmo",
      betaTitle: "Estamos em beta!",
      betaBody: "Alguns recursos podem ser limitados ou mudar. Ajude-nos a melhorar — envie seu feedback!",
      betaTime: "Agora mesmo",
    },
    cta: { title: "Comece a economizar hoje!", description: "Experimente o futuro da gestao financeira com o Finquanta AI", button: "Cadastre-se agora" },
    settings: {
      languageSettings: "Configuracoes de idioma", displayLanguage: "Idioma de exibicao", changeLanguageAcrossSite: "Isso mudara o idioma em todo o site.", notificationSettings: "Configuracoes de notificacao", selectNotificationPreference: "Selecione sua preferencia de notificacao", giveFeedback: "Enviar feedback", logOut: "Sair", deleteAccount: "Excluir conta", deleteAccountWarning: "Fechar sua conta nao pode ser desfeito.", deleteAccountNow: "Excluir conta agora", languageRegion: "Idioma e regiao", configureLanguageSettings: "Configure seu idioma preferido", timeZone: "Fuso horario", selectTimezone: "Selecione o fuso horario", currentTime: "Hora atual:", dateFormat: "Formato de data", today: "Hoje:", timeFormat: "Formato de hora", twelveHour: "12 horas (AM/PM)", twentyFourHour: "24 horas", currency: "Moeda", example: "Exemplo:", measurementSystem: "Sistema de medida", metric: "Metrico (kg, cm, L)", imperial: "Imperial (lbs, ft, gal)", numberFormat: "Formato numerico", regionalPreferences: "Preferencias regionais", regionSettingsDescription: "Essas configuracoes ajudam a personalizar sua experiencia.", weekStartsOn: "Semana comeca em:", newsAndUpdates: "Noticias e atualizacoes", newsAboutProducts: "Noticias sobre atualizacoes de produtos.", reminders: "Lembretes", getRemindersDescription: "Receba uma notificacao para lembrá-lo de atualizacoes.", pushNotifications: "Notificacoes push", pushNotificationsDescription: "Receba notificacao no aplicativo.", changePhotoProfile: "Alterar foto do perfil", delete: "Excluir", save: "Salvar", saveChanges: "Salvar alteracoes", role: "Funcao", enterYourRole: "Digite sua funcao", companyName: "Nome da empresa", enterCompanyName: "Digite o nome da empresa", companyEmail: "Email da empresa", enterCompanyEmail: "Digite o email da empresa", linkedin: "LinkedIn", enterLinkedinUrl: "Digite a URL do LinkedIn", dateOfIncorporation: "Data de constituicao", countryOfHeadquartered: "Pais da sede", selectACountry: "Selecione um pais", feedbackComingSoon: "Formulario de feedback em breve.", themeSettings: "Configuracoes de tema", selectAppearance: "Escolha sua aparencia preferida", lightModeDescription: "Tema claro para uso diurno", darkModeDescription: "Tema escuro para reduzir a fadiga visual",
      feedbackPopupTitle: "Sua opiniao importa!",
      feedbackPopupDesc: "Ajude-nos a melhorar o Finquanta AI. Compartilhe seus pensamentos com nossa equipe!",
      feedbackPopupButton: "Enviar feedback",
    }
  },
  ar: {
    nav: { features: "الميزات", faqs: "الأسئلة الشائعة", newsletter: "النشرة الإخبارية", community: "المجتمع", blog: "المدونة", scheduleDemo: "جدولة عرض", signUp: "التسجيل", login: "تسجيل الدخول" },
    hero: { title: "حول أموالك بقوة الذكاء الاصطناعي!", description: "أحدث ثورة في أموالك مع تطبيقنا.", subscribe: "اشترك الآن", emailPlaceholder: "أدخل بريدك الإلكتروني", notice: "اشترك في نشرة Finquanta AI الإخبارية." },
    features: { banner: "تحسين القرارات المالية من خلال تقنية الذكاء الاصطناعي.", title: "يركز مساعدنا الذكي على ما يهم أكثر", tagline: "تقديم استراتيجيات مالية ذكية لعملك.", maturity: "النضج", maturityDesc: "استراتيجيات ذكية لكل مرحلة.", nature: "الطبيعة", natureDesc: "رؤى خاصة بالصناعة.", niche: "المجال", nicheDesc: "توجيه مالي بناء على نموذج عملك.", financialHealth: "الصحة المالية", financialHealthDesc: "ابق على اطلاع على التدفق النقدي والمصروفات." },
    faq: { title: "الأسئلة الشائعة", q1: "كم تكلفة Finquanta AI?", a1: "نقدم خطة مجانية وخططا مدفوعة.", q2: "كيف يعمل Finquanta AI?", a2: "يحلل الذكاء الاصطناعي أموالك ويقدم توصيات ذكية.", q3: "ما فوائد استخدام Finquanta AI?", a3: "وفر الوقت واتخذ قرارات مالية أذكى." },
    newsletter: { title: "ابق على اطلاع", description: "اشترك في نشرة Finquanta AI الإخبارية.", emailPlaceholder: "أدخل بريدك الإلكتروني", subscribe: "اشترك الآن" },
    community: { title: "يمكنك أيضا الاتصال بنا على" },
    footer: { terms: "شروط الخدمة", privacy: "إشعار الخصوصية", aiRisk: "إفصاح مخاطر الذكاء الاصطناعي" },
    legal: { returnHome: "العودة إلى الصفحة الرئيسية", termsTitle: "شروط خدمة FINQUANTA", termsIntro: "تحكم شروط الخدمة هذه وصولك واستخدامك لمنصة Finquanta.", privacyTitle: "إشعار خصوصية FINQUANTA", privacyIntro: "تلتزم Finquanta بحماية خصوصية المعلومات المالية.", aiRiskTitle: "إفصاح مخاطر الذكاء الاصطناعي في FINQUANTA", aiRiskIntro: "تستخدم Finquanta الذكاء الاصطناعي لمساعدة الشركات." },
    auth: { login: "تسجيل الدخول", signUp: "التسجيل", email: "البريد الإلكتروني", password: "كلمة المرور", confirmPassword: "تأكيد كلمة المرور", forgotPassword: "هل نسيت كلمة المرور؟", rememberMe: "تذكرني", loginButton: "تسجيل الدخول", signUpButton: "إنشاء حساب", alreadyHaveAccount: "هل لديك حساب بالفعل؟", dontHaveAccount: "ليس لديك حساب؟", loginWithGoogle: "تسجيل الدخول عبر Google", signUpWithGoogle: "التسجيل عبر Google", resetPassword: "إعادة تعيين كلمة المرور", resetPasswordDesc: "أدخل بريدك وسنرسل لك رابطا.", sendResetLink: "إرسال الرابط", backToSignIn: "العودة إلى تسجيل الدخول", checkEmail: "تحقق من بريدك", resetLinkSent: "أرسلنا رابطا إلى" },
    dashboard: { title: "لوحة التحكم", profileSettings: "إعدادات الملف الشخصي", termsOfService: "شروط الخدمة", privacyPolicy: "سياسة الخصوصية", aiRiskDisclosure: "إفصاح مخاطر الذكاء الاصطناعي", search: "البحث", balance: "الرصيد", cashflow: "تدفق النقد", expense: "المصروف", bookkeeping: "المحاسبة", last30Days: "آخر 30 يوم", addData: "إضافة بيانات", date: "التاريخ", type: "النوع", detail: "التفاصيل", price: "السعر", amount: "المبلغ", noTransactions: "لا توجد معاملات بعد", totalRevenue: "إجمالي الإيرادات", noDataYet: "لا توجد بيانات بعد", goals: "الأهداف", addGoal: "إضافة هدف", noGoalsAdded: "لم تضف أي أهداف بعد", bankAccount: "الحساب البنكي", light: "فاتح", dark: "غامق", version: "الإصدار" },
    notifications: {
      title: "الإشعارات",
      markAllRead: "تحديد الكل كمقروء",
      noNotifications: "لا توجد إشعارات",
      welcomeTitle: "مرحبا بك في Finquanta!",
      welcomeBody: "تم إعداد حسابك وهو جاهز للاستخدام. يسعدنا انضمامك إلينا.",
      welcomeTime: "الآن",
      betaTitle: "نحن في مرحلة التجربة!",
      betaBody: "قد تكون بعض الميزات محدودة أو تتغير. ساعدنا على التحسين — أرسل ملاحظاتك!",
      betaTime: "الآن",
    },
    cta: { title: "ابدأ التوفير اليوم!", description: "اختبر مستقبل إدارة الأموال مع Finquanta AI", button: "سجل الآن" },
    settings: {
      languageSettings: "إعدادات اللغة", displayLanguage: "لغة العرض", changeLanguageAcrossSite: "سيؤدي هذا إلى تغيير اللغة في جميع أنحاء الموقع.", notificationSettings: "إعدادات الإشعارات", selectNotificationPreference: "حدد تفضيل الإشعارات الخاص بك", giveFeedback: "إرسال ملاحظات", logOut: "تسجيل الخروج", deleteAccount: "حذف الحساب", deleteAccountWarning: "لا يمكن التراجع عن إغلاق حسابك.", deleteAccountNow: "حذف الحساب الآن", languageRegion: "اللغة والمنطقة", configureLanguageSettings: "قم بتكوين لغتك المفضلة", timeZone: "المنطقة الزمنية", selectTimezone: "اختر المنطقة الزمنية", currentTime: "الوقت الحالي:", dateFormat: "صيغة التاريخ", today: "اليوم:", timeFormat: "صيغة الوقت", twelveHour: "12 ساعة (صباحا/مساء)", twentyFourHour: "24 ساعة", currency: "العملة", example: "مثال:", measurementSystem: "نظام القياس", metric: "مترية (كجم، سم، لتر)", imperial: "إمبراطورية (جنيه، قدم، جالون)", numberFormat: "صيغة الأرقام", regionalPreferences: "التفضيلات الإقليمية", regionSettingsDescription: "تساعد هذه الإعدادات في تخصيص تجربتك.", weekStartsOn: "تبدأ الأسبوع يوم:", newsAndUpdates: "الأخبار والتحديثات", newsAboutProducts: "أخبار عن تحديثات المنتجات.", reminders: "تذكيرات", getRemindersDescription: "احصل على إشعار لتذكيرك بالتحديثات.", pushNotifications: "إشعارات فورية", pushNotificationsDescription: "احصل على إشعار في التطبيق.", changePhotoProfile: "تغيير صورة الملف الشخصي", delete: "حذف", save: "حفظ", saveChanges: "حفظ التغييرات", role: "الدور", enterYourRole: "أدخل دورك", companyName: "اسم الشركة", enterCompanyName: "أدخل اسم الشركة", companyEmail: "بريد الشركة", enterCompanyEmail: "أدخل بريد الشركة", linkedin: "LinkedIn", enterLinkedinUrl: "أدخل عنوان URL لـ LinkedIn", dateOfIncorporation: "تاريخ التأسيس", countryOfHeadquartered: "دولة المقر الرئيسي", selectACountry: "اختر دولة", feedbackComingSoon: "نموذج الملاحظات قريبا.", themeSettings: "إعدادات المظهر", selectAppearance: "اختر مظهرك المفضل", lightModeDescription: "مظهر فاتح لاستخدام النهار", darkModeDescription: "مظهر غامق لتقليل إجهاد العين",
      feedbackPopupTitle: "رأيك يهمنا!",
      feedbackPopupDesc: "ساعدنا في تحسين Finquanta AI. شارك أفكارك مع فريقنا!",
      feedbackPopupButton: "إرسال ملاحظات",
    }
  },
  zh: {
    nav: { features: "功能", faqs: "常见问题", newsletter: "新闻通讯", community: "社区", blog: "博客", scheduleDemo: "安排演示", signUp: "注册", login: "登录" },
    hero: { title: "用AI的力量改变您的财务!", description: "用我们的AI应用程序彻底改变您的财务管理。", subscribe: "立即订阅", emailPlaceholder: "输入您的邮箱", notice: "订阅Finquanta AI新闻通讯获取最新信息。" },
    features: { banner: "通过强大的AI技术优化财务决策。", title: "我们的AI助手专注于最重要的事情", tagline: "为您的业务提供智能财务战略。", maturity: "成熟度", maturityDesc: "智能策略针对每个阶段。", nature: "性质", natureDesc: "特定行业的见解。", niche: "利基", nicheDesc: "基于您的业务模式的财务指导。", financialHealth: "财务健康", financialHealthDesc: "掌握您的现金流、支出和利润。" },
    faq: { title: "常见问题", q1: "Finquanta AI的费用是多少?", a1: "我们提供免费计划和付费计划。", q2: "Finquanta AI如何工作?", a2: "我们的AI分析您的财务并提供智能建议。", q3: "使用Finquanta AI的好处是什么?", a3: "节省时间，做出更聪明的财务决定。" },
    newsletter: { title: "了解最新信息", description: "订阅Finquanta AI新闻通讯获取最新信息。", emailPlaceholder: "输入您的邮箱", subscribe: "立即订阅" },
    community: { title: "您也可以在以下地方与我们联系" },
    footer: { terms: "服务条款", privacy: "隐私通知", aiRisk: "AI风险披露" },
    legal: { returnHome: "返回首页", termsTitle: "FINQUANTA服务条款", termsIntro: "这些服务条款管理您对Finquanta平台的访问和使用。", privacyTitle: "FINQUANTA隐私通知", privacyIntro: "Finquanta致力于保护财务信息的隐私和安全。", aiRiskTitle: "FINQUANTA AI风险披露", aiRiskIntro: "Finquanta使用人工智能帮助企业管理财务数据。" },
    auth: { login: "登录", signUp: "注册", email: "电子邮件", password: "密码", confirmPassword: "确认密码", forgotPassword: "忘记密码?", rememberMe: "记住我", loginButton: "登录", signUpButton: "创建帐户", alreadyHaveAccount: "已有帐户?", dontHaveAccount: "没有帐户?", loginWithGoogle: "使用Google登录", signUpWithGoogle: "使用Google注册", resetPassword: "重置您的密码", resetPasswordDesc: "输入您的邮箱，我们将发送重置链接。", sendResetLink: "发送重置链接", backToSignIn: "返回登录", checkEmail: "检查您的邮箱", resetLinkSent: "我们已将链接发送至" },
    dashboard: { title: "仪表板", profileSettings: "配置文件设置", termsOfService: "服务条款", privacyPolicy: "隐私政策", aiRiskDisclosure: "AI风险披露", search: "搜索", balance: "余额", cashflow: "现金流", expense: "支出", bookkeeping: "簿记", last30Days: "最后30天", addData: "添加数据", date: "日期", type: "类型", detail: "详情", price: "价格", amount: "金额", noTransactions: "还没有交易", totalRevenue: "总收入", noDataYet: "还没有数据", goals: "目标", addGoal: "添加目标", noGoalsAdded: "还没有添加任何目标", bankAccount: "银行帐户", light: "浅色", dark: "深色", version: "版本" },
    notifications: {
      title: "通知",
      markAllRead: "全部标为已读",
      noNotifications: "没有通知",
      welcomeTitle: "欢迎使用Finquanta!",
      welcomeBody: "您的帐户已设置完毕，可以使用。很高兴您的加入。",
      welcomeTime: "刚刚",
      betaTitle: "我们正在测试版!",
      betaBody: "某些功能可能受限或发生变化。帮助我们改进 — 提交您的反馈!",
      betaTime: "刚刚",
    },
    cta: { title: "今天就开始储蓄!", description: "立即体验Finquanta AI带来的财务管理未来", button: "立即注册" },
    settings: {
      languageSettings: "语言设置", displayLanguage: "显示语言", changeLanguageAcrossSite: "这将改变整个网站的语言。", notificationSettings: "通知设置", selectNotificationPreference: "选择您的通知偏好", giveFeedback: "提供反馈", logOut: "登出", deleteAccount: "删除帐户", deleteAccountWarning: "关闭您的帐户无法撤销。", deleteAccountNow: "立即删除帐户", languageRegion: "语言和地区", configureLanguageSettings: "配置您首选的语言", timeZone: "时区", selectTimezone: "选择时区", currentTime: "当前时间:", dateFormat: "日期格式", today: "今天:", timeFormat: "时间格式", twelveHour: "12小时（上午/下午）", twentyFourHour: "24小时", currency: "货币", example: "例:", measurementSystem: "度量系统", metric: "公制（千克、厘米、升）", imperial: "帝国制（磅、英尺、加仑）", numberFormat: "数字格式", regionalPreferences: "地区偏好", regionSettingsDescription: "这些设置帮助根据您的位置和偏好自定义您的体验。", weekStartsOn: "周开始于:", newsAndUpdates: "新闻和更新", newsAboutProducts: "关于产品和功能更新的新闻。", reminders: "提醒", getRemindersDescription: "收到通知以提醒您可能错过的更新。", pushNotifications: "推送通知", pushNotificationsDescription: "收到关于您的节省和投资的应用内通知。", changePhotoProfile: "更改个人资料照片", delete: "删除", save: "保存", saveChanges: "保存更改", role: "角色", enterYourRole: "输入您的角色", companyName: "公司名称", enterCompanyName: "输入公司名称", companyEmail: "公司邮箱", enterCompanyEmail: "输入公司邮箱", linkedin: "LinkedIn", enterLinkedinUrl: "输入LinkedIn网址", dateOfIncorporation: "成立日期", countryOfHeadquartered: "总部所在国", selectACountry: "选择国家", feedbackComingSoon: "反馈表即将推出。", themeSettings: "主题设置", selectAppearance: "选择您喜欢的外观", lightModeDescription: "用于白天使用的浅色主题", darkModeDescription: "深色主题可减少眼睛疲劳",
      feedbackPopupTitle: "您的意见很重要!",
      feedbackPopupDesc: "帮助我们改进 Finquanta AI。与我们的团队分享您的想法!",
      feedbackPopupButton: "提交反馈",
    }
  },
  ja: {
    nav: { features: "機能", faqs: "よくある質問", newsletter: "ニュースレター", community: "コミュニティ", blog: "ブログ", scheduleDemo: "デモをスケジュール", signUp: "サインアップ", login: "ログイン" },
    hero: { title: "AIの力であなたの財務を変える!", description: "AIアプリで財務を革命化しましょう。", subscribe: "今すぐ購読", emailPlaceholder: "メールアドレスを入力", notice: "Finquanta AIニュースレターに登録して最新情報を取得。" },
    features: { banner: "強力なAI技術で財務決定を最適化。", title: "当社のAIアシスタントは最も重要なことに焦点を当てています", tagline: "ビジネスのための賢い財務戦略を提供します。", maturity: "成熟度", maturityDesc: "各段階のための賢い戦略。", nature: "性質", natureDesc: "業界固有の洞察。", niche: "ニッチ", nicheDesc: "ビジネスモデルに基づいた財務指導。", financialHealth: "財務健全性", financialHealthDesc: "キャッシュフロー、支出、利益を把握。" },
    faq: { title: "よくある質問", q1: "Finquanta AIの費用は?", a1: "無料プランと有料プランを提供しています。", q2: "Finquanta AIはどのように機能しますか?", a2: "私たちのAIがあなたの財務を分析し、提案を提供します。", q3: "Finquanta AIの利点は何ですか?", a3: "時間を節約し、より賢い財務決定を下します。" },
    newsletter: { title: "最新情報を取得", description: "Finquanta AIニュースレターに登録して最新情報を取得。", emailPlaceholder: "メールアドレスを入力", subscribe: "今すぐ購読" },
    community: { title: "以下でも私たちに接続できます" },
    footer: { terms: "利用規約", privacy: "プライバシー通知", aiRisk: "AIリスク開示" },
    legal: { returnHome: "ホームページに戻る", termsTitle: "FINQUANTAサービス利用規約", termsIntro: "これらの利用規約はFinquantaプラットフォームへのアクセスと使用を管理します。", privacyTitle: "FINQUANTAプライバシー通知", privacyIntro: "Finquantaは財務情報のプライバシーとセキュリティを保護することに専念しています。", aiRiskTitle: "FINQUANTA AIリスク開示", aiRiskIntro: "Finquantaは企業が財務データを管理するために人工知能を使用しています。" },
    auth: { login: "ログイン", signUp: "サインアップ", email: "メール", password: "パスワード", confirmPassword: "パスワードを確認", forgotPassword: "パスワードをお忘れですか?", rememberMe: "私を覚えておいて", loginButton: "ログイン", signUpButton: "アカウントを作成", alreadyHaveAccount: "既にアカウントをお持ちですか?", dontHaveAccount: "アカウントをお持ちではありませんか?", loginWithGoogle: "Googleでログイン", signUpWithGoogle: "Googleでサインアップ", resetPassword: "パスワードをリセット", resetPasswordDesc: "メールアドレスを入力してください。リセットリンクを送信します。", sendResetLink: "リセットリンクを送信", backToSignIn: "ログインに戻る", checkEmail: "メールを確認", resetLinkSent: "リンクを送信しました" },
    dashboard: { title: "ダッシュボード", profileSettings: "プロフィール設定", termsOfService: "サービス利用規約", privacyPolicy: "プライバシーポリシー", aiRiskDisclosure: "AIリスク開示", search: "検索", balance: "残高", cashflow: "キャッシュフロー", expense: "支出", bookkeeping: "簿記", last30Days: "過去30日", addData: "データを追加", date: "日付", type: "タイプ", detail: "詳細", price: "価格", amount: "金額", noTransactions: "まだトランザクションがありません", totalRevenue: "総収益", noDataYet: "まだデータがありません", goals: "目標", addGoal: "目標を追加", noGoalsAdded: "まだ目標が追加されていません", bankAccount: "銀行口座", light: "ライト", dark: "ダーク", version: "バージョン" },
    notifications: {
      title: "通知",
      markAllRead: "すべて既読にする",
      noNotifications: "通知はありません",
      welcomeTitle: "Finquantaへようこそ!",
      welcomeBody: "アカウントが設定され、使用準備が整いました。ご参加いただき嬉しいです。",
      welcomeTime: "たった今",
      betaTitle: "ベータ版です!",
      betaBody: "一部の機能は制限されているか変更される場合があります。改善にご協力ください — フィードバックをお送りください!",
      betaTime: "たった今",
    },
    cta: { title: "今日から節約を始めよう!", description: "Finquanta AIで財務管理の未来を体験してください", button: "今すぐ登録" },
    settings: {
      languageSettings: "言語設定", displayLanguage: "表示言語", changeLanguageAcrossSite: "これはサイト全体の言語を変更します。", notificationSettings: "通知設定", selectNotificationPreference: "通知の環境設定を選択", giveFeedback: "フィードバックを提供", logOut: "ログアウト", deleteAccount: "アカウントを削除", deleteAccountWarning: "アカウントを閉じることは取り消せません。", deleteAccountNow: "今すぐアカウントを削除", languageRegion: "言語と地域", configureLanguageSettings: "希望の言語を構成", timeZone: "タイムゾーン", selectTimezone: "タイムゾーンを選択", currentTime: "現在の時刻:", dateFormat: "日付形式", today: "今日:", timeFormat: "時間形式", twelveHour: "12時間（午前/午後）", twentyFourHour: "24時間", currency: "通貨", example: "例:", measurementSystem: "計測システム", metric: "メートル法（kg、cm、L）", imperial: "帝国制度（ポンド、フィート、ガロン）", numberFormat: "数値形式", regionalPreferences: "地域設定", regionSettingsDescription: "これらの設定は体験をカスタマイズするのに役立ちます。", weekStartsOn: "週の始まり:", newsAndUpdates: "ニュースと更新", newsAboutProducts: "製品とフィーチャー更新に関するニュース。", reminders: "リマインダー", getRemindersDescription: "見逃したかもしれない更新を思い出させるための通知を受け取ります。", pushNotifications: "プッシュ通知", pushNotificationsDescription: "貯蓄と投資に関するアプリ内通知を受け取ります。", changePhotoProfile: "プロフィール写真を変更", delete: "削除", save: "保存", saveChanges: "変更を保存", role: "役割", enterYourRole: "あなたの役割を入力", companyName: "会社名", enterCompanyName: "会社名を入力", companyEmail: "会社メール", enterCompanyEmail: "会社メールを入力", linkedin: "LinkedIn", enterLinkedinUrl: "LinkedInのURLを入力", dateOfIncorporation: "設立日", countryOfHeadquartered: "本社所在地", selectACountry: "国を選択", feedbackComingSoon: "フィードバックフォームは近日公開予定です。", themeSettings: "テーマ設定", selectAppearance: "希望の外観を選択", lightModeDescription: "昼間使用のためのライトテーマ", darkModeDescription: "目の疲れを軽減するダークテーマ",
      feedbackPopupTitle: "あなたの意見をお聞かせください!",
      feedbackPopupDesc: "Finquanta AIの改善にご協力ください。チームにご意見をお寄せください!",
      feedbackPopupButton: "フィードバックを送信",
    }
  },
  ru: {
    nav: { features: "Функции", faqs: "ЧЗВ", newsletter: "Информационный бюллетень", community: "Сообщество", blog: "Блог", scheduleDemo: "Запланировать демонстрацию", signUp: "Зарегистрироваться", login: "Вход" },
    hero: { title: "Преобразуйте свои финансы с помощью ИИ!", description: "Революционизируйте ваши финансы с помощью нашего приложения на основе ИИ.", subscribe: "Подписаться", emailPlaceholder: "Введите ваш email", notice: "Подпишитесь на рассылку Finquanta AI для получения последних новостей." },
    features: { banner: "Оптимизация финансовых решений с помощью мощной технологии ИИ.", title: "Наш умный помощник сосредоточен на самом важном", tagline: "предоставление умных финансовых стратегий для вашего бизнеса.", maturity: "Зрелость", maturityDesc: "Умные стратегии для каждого этапа.", nature: "Природа", natureDesc: "Отраслевые идеи.", niche: "Ниша", nicheDesc: "Финансовое руководство на основе вашей бизнес-модели.", financialHealth: "Финансовое здоровье", financialHealthDesc: "Будьте в курсе своего денежного потока, расходов и прибыли." },
    faq: { title: "Часто Задаваемые Вопросы", q1: "Сколько стоит Finquanta AI?", a1: "Мы предлагаем бесплатный план и платные планы.", q2: "Как работает Finquanta AI?", a2: "Наш ИИ анализирует ваши финансы и дает умные рекомендации.", q3: "Каковы преимущества Finquanta AI?", a3: "Экономьте время и принимайте более разумные финансовые решения." },
    newsletter: { title: "Оставайтесь в курсе", description: "Подпишитесь на рассылку Finquanta AI.", emailPlaceholder: "Введите ваш email", subscribe: "Подписаться" },
    community: { title: "Вы также можете связаться с нами на" },
    footer: { terms: "условия обслуживания", privacy: "уведомление о конфиденциальности", aiRisk: "раскрытие рисков ИИ" },
    legal: { returnHome: "Вернуться на главную", termsTitle: "Условия обслуживания FINQUANTA", termsIntro: "Эти условия обслуживания регулируют ваш доступ и использование платформы Finquanta.", privacyTitle: "Уведомление о конфиденциальности FINQUANTA", privacyIntro: "Finquanta стремится защищать конфиденциальность финансовой информации.", aiRiskTitle: "Раскрытие рисков ИИ FINQUANTA", aiRiskIntro: "Finquanta использует искусственный интеллект для управления финансовыми данными." },
    auth: { login: "Вход", signUp: "Зарегистрироваться", email: "Email", password: "Пароль", confirmPassword: "Подтвердить пароль", forgotPassword: "Забыли пароль?", rememberMe: "Запомнить меня", loginButton: "Вход", signUpButton: "Создать аккаунт", alreadyHaveAccount: "Уже есть аккаунт?", dontHaveAccount: "Нет аккаунта?", loginWithGoogle: "Вход через Google", signUpWithGoogle: "Регистрация через Google", resetPassword: "Сбросить пароль", resetPasswordDesc: "Введите ваш email и мы отправим вам ссылку.", sendResetLink: "Отправить ссылку", backToSignIn: "Вернуться к входу", checkEmail: "Проверьте ваш email", resetLinkSent: "Мы отправили ссылку на" },
    dashboard: { title: "Панель управления", profileSettings: "Параметры профиля", termsOfService: "Условия обслуживания", privacyPolicy: "Политика конфиденциальности", aiRiskDisclosure: "Раскрытие рисков ИИ", search: "Поиск", balance: "Баланс", cashflow: "Денежный поток", expense: "Расход", bookkeeping: "Бухгалтерский учет", last30Days: "Последние 30 дней", addData: "Добавить данные", date: "Дата", type: "Тип", detail: "Деталь", price: "Цена", amount: "Сумма", noTransactions: "Пока нет транзакций", totalRevenue: "Общий доход", noDataYet: "Пока нет данных", goals: "Цели", addGoal: "Добавить цель", noGoalsAdded: "Цели еще не добавлены", bankAccount: "Банковский счет", light: "Свет", dark: "Темно", version: "Версия" },
    notifications: {
      title: "Уведомления",
      markAllRead: "Отметить все как прочитанные",
      noNotifications: "Нет уведомлений",
      welcomeTitle: "Добро пожаловать в Finquanta!",
      welcomeBody: "Ваш аккаунт настроен и готов к использованию. Мы рады вас видеть.",
      welcomeTime: "Только что",
      betaTitle: "Мы в бета-версии!",
      betaBody: "Некоторые функции могут быть ограничены или изменятся. Помогите нам улучшиться — отправьте отзыв!",
      betaTime: "Только что",
    },
    cta: { title: "Начните экономить сегодня!", description: "Откройте для себя будущее финансового управления с Finquanta AI", button: "Зарегистрироваться" },
    settings: {
      languageSettings: "Параметры языка", displayLanguage: "Язык отображения", changeLanguageAcrossSite: "Это изменит язык на всем сайте.", notificationSettings: "Параметры уведомлений", selectNotificationPreference: "Выберите предпочтение уведомлений", giveFeedback: "Оставить отзыв", logOut: "Выход", deleteAccount: "Удалить аккаунт", deleteAccountWarning: "Закрытие вашего аккаунта невозможно отменить.", deleteAccountNow: "Удалить аккаунт сейчас", languageRegion: "Язык и регион", configureLanguageSettings: "Настройте предпочитаемый язык", timeZone: "Часовой пояс", selectTimezone: "Выберите часовой пояс", currentTime: "Текущее время:", dateFormat: "Формат даты", today: "Сегодня:", timeFormat: "Формат времени", twelveHour: "12 часов (AM/PM)", twentyFourHour: "24 часа", currency: "Валюта", example: "Пример:", measurementSystem: "Система измерения", metric: "Метрическая (кг, см, л)", imperial: "Имперская (фунты, футы, галлоны)", numberFormat: "Числовой формат", regionalPreferences: "Региональные предпочтения", regionSettingsDescription: "Эти параметры помогают настроить ваш опыт.", weekStartsOn: "Неделя начинается с:", newsAndUpdates: "Новости и обновления", newsAboutProducts: "Новости об обновлениях продуктов.", reminders: "Напоминания", getRemindersDescription: "Получайте уведомления о пропущенных обновлениях.", pushNotifications: "Push-уведомления", pushNotificationsDescription: "Получайте уведомления в приложении.", changePhotoProfile: "Изменить фото профиля", delete: "Удалить", save: "Сохранить", saveChanges: "Сохранить изменения", role: "Роль", enterYourRole: "Введите вашу роль", companyName: "Название компании", enterCompanyName: "Введите название компании", companyEmail: "Email компании", enterCompanyEmail: "Введите email компании", linkedin: "LinkedIn", enterLinkedinUrl: "Введите URL LinkedIn", dateOfIncorporation: "Дата регистрации", countryOfHeadquartered: "Страна штаб-квартиры", selectACountry: "Выберите страну", feedbackComingSoon: "Форма обратной связи скоро.", themeSettings: "Настройки темы", selectAppearance: "Выберите предпочитаемый внешний вид", lightModeDescription: "Светлая тема для использования в течение дня", darkModeDescription: "Темная тема для снижения нагрузки на глаза",
      feedbackPopupTitle: "Ваше мнение важно!",
      feedbackPopupDesc: "Помогите нам улучшить Finquanta AI. Поделитесь своими мыслями с нашей командой!",
      feedbackPopupButton: "Отправить отзыв",
    }
  }
};

// Additional dashboard strings (reminders, goals, revenue chart, modals, etc.).
// Kept separate so they merge into each language's `dashboard` namespace without
// editing the large inline maps above. Missing keys fall back to English via t().
const dashboardExtra: Record<string, Record<string, string>> = {
  en: {
    workspace: "Workspace", sendFeedback: "Send feedback",
    finquantaId: "Finquanta ID", yourName: "Your name", editNameTitle: "Click to edit your name",
    reminders: "Reminders", addReminderPlaceholder: "Add a reminder…", add: "Add", noReminders: "No reminders yet. Add one above.",
    restore: "Restore", clear: "Clear", recentlyDeleted: "Recently deleted", deleted: "Deleted", undo: "Undo",
    goalPromptTitle: "How are your goals going?", goalPromptBody: "You haven't updated your goals in a while. Want to log your progress?", updateGoals: "Update goals", later: "Later",
    rangeDay: "Day", rangeMonth: "Month", rangeYear: "Year", loading: "Loading…",
    editBookkeeping: "Edit Bookkeeping Data", enterBookkeeping: "Enter Bookkeeping Data",
    invoiceNameLabel: "Invoice Name", invoiceNamePlaceholder: "Invoice Here", invoiceDescriptionLabel: "Invoice Description", invoiceDescriptionPlaceholder: "Text Here",
    invoiceAmountLabel: "Invoice Amount", enterValue: "Enter Value", invoiceTypeLabel: "Invoice Type", dateOfInvoiceLabel: "Date of Invoice",
    saveChanges: "Save Changes", enterData: "Enter Data", saving: "Saving…",
    errInvoiceName: "Please enter an invoice name.", errAmount: "Please enter an amount greater than 0.", errDate: "Please choose a date.",
    editGoalTitle: "Edit Goal", enterGoalTitle: "Enter Goal", goalLabel: "Goal", goalPlaceholder: "e.g. Close a real estate deal, Get 10 product sales",
    targetLabel: "Target", targetPlaceholder: "e.g. 1 for a yes/no goal, 10 for 10 sales, 5000 to save 5000", progressLabel: "Progress so far",
    errGoalName: "Please enter a goal name.", errTarget: "Please enter a target amount greater than 0.", errProgress: "Progress cannot be negative.",
    genericError: "Something went wrong. Please try again.",
    recurrenceLabel: "Recurrence", recurrenceOnce: "One-time", recurrenceMonthly: "Monthly", recurrenceYearly: "Yearly",
    receiptLabel: "Receipt (PDF/image)", receiptAttached: "A receipt is attached. Choose a file to replace it.", viewReceipt: "View receipt",
  },
  nl: {
    finquantaId: "Finquanta-ID", yourName: "Uw naam", editNameTitle: "Klik om uw naam te bewerken",
    reminders: "Herinneringen", addReminderPlaceholder: "Voeg een herinnering toe…", add: "Toevoegen", noReminders: "Nog geen herinneringen. Voeg er hierboven een toe.",
    restore: "Herstellen", clear: "Wissen", recentlyDeleted: "Recent verwijderd", deleted: "Verwijderd", undo: "Ongedaan maken",
    goalPromptTitle: "Hoe gaat het met uw doelen?", goalPromptBody: "U heeft uw doelen al een tijdje niet bijgewerkt. Wilt u uw voortgang vastleggen?", updateGoals: "Doelen bijwerken", later: "Later",
    rangeDay: "Dag", rangeMonth: "Maand", rangeYear: "Jaar", loading: "Laden…",
    editBookkeeping: "Boekhoudgegevens bewerken", enterBookkeeping: "Boekhoudgegevens invoeren",
    invoiceNameLabel: "Factuurnaam", invoiceNamePlaceholder: "Factuur hier", invoiceDescriptionLabel: "Factuuromschrijving", invoiceDescriptionPlaceholder: "Tekst hier",
    invoiceAmountLabel: "Factuurbedrag", enterValue: "Voer waarde in", invoiceTypeLabel: "Factuurtype", dateOfInvoiceLabel: "Factuurdatum",
    saveChanges: "Wijzigingen opslaan", enterData: "Gegevens invoeren", saving: "Opslaan…",
    errInvoiceName: "Voer een factuurnaam in.", errAmount: "Voer een bedrag groter dan 0 in.", errDate: "Kies een datum.",
    editGoalTitle: "Doel bewerken", enterGoalTitle: "Doel invoeren", goalLabel: "Doel", goalPlaceholder: "bijv. Een vastgoeddeal sluiten, 10 productverkopen halen",
    targetLabel: "Doelwaarde", targetPlaceholder: "bijv. 1 voor een ja/nee-doel, 10 voor 10 verkopen, 5000 om 5000 te sparen", progressLabel: "Voortgang tot nu toe",
    errGoalName: "Voer een doelnaam in.", errTarget: "Voer een doelwaarde groter dan 0 in.", errProgress: "Voortgang kan niet negatief zijn.",
    genericError: "Er is iets misgegaan. Probeer het opnieuw.",
    recurrenceLabel: "Herhaling", recurrenceOnce: "Eenmalig", recurrenceMonthly: "Maandelijks", recurrenceYearly: "Jaarlijks",
    receiptLabel: "Bon (PDF/afbeelding)", receiptAttached: "Er is een bon bijgevoegd. Kies een bestand om te vervangen.", viewReceipt: "Bon bekijken",
  },
  de: {
    finquantaId: "Finquanta-ID", yourName: "Ihr Name", editNameTitle: "Klicken, um Ihren Namen zu bearbeiten",
    reminders: "Erinnerungen", addReminderPlaceholder: "Erinnerung hinzufügen…", add: "Hinzufügen", noReminders: "Noch keine Erinnerungen. Fügen Sie oben eine hinzu.",
    restore: "Wiederherstellen", clear: "Löschen", recentlyDeleted: "Kürzlich gelöscht", deleted: "Gelöscht", undo: "Rückgängig",
    goalPromptTitle: "Wie laufen Ihre Ziele?", goalPromptBody: "Sie haben Ihre Ziele eine Weile nicht aktualisiert. Möchten Sie Ihren Fortschritt erfassen?", updateGoals: "Ziele aktualisieren", later: "Später",
    rangeDay: "Tag", rangeMonth: "Monat", rangeYear: "Jahr", loading: "Wird geladen…",
    editBookkeeping: "Buchhaltungsdaten bearbeiten", enterBookkeeping: "Buchhaltungsdaten eingeben",
    invoiceNameLabel: "Rechnungsname", invoiceNamePlaceholder: "Rechnung hier", invoiceDescriptionLabel: "Rechnungsbeschreibung", invoiceDescriptionPlaceholder: "Text hier",
    invoiceAmountLabel: "Rechnungsbetrag", enterValue: "Wert eingeben", invoiceTypeLabel: "Rechnungstyp", dateOfInvoiceLabel: "Rechnungsdatum",
    saveChanges: "Änderungen speichern", enterData: "Daten eingeben", saving: "Wird gespeichert…",
    errInvoiceName: "Bitte geben Sie einen Rechnungsnamen ein.", errAmount: "Bitte geben Sie einen Betrag größer als 0 ein.", errDate: "Bitte wählen Sie ein Datum.",
    editGoalTitle: "Ziel bearbeiten", enterGoalTitle: "Ziel eingeben", goalLabel: "Ziel", goalPlaceholder: "z. B. Einen Immobiliendeal abschließen, 10 Produktverkäufe erzielen",
    targetLabel: "Zielwert", targetPlaceholder: "z. B. 1 für ein Ja/Nein-Ziel, 10 für 10 Verkäufe, 5000 um 5000 zu sparen", progressLabel: "Bisheriger Fortschritt",
    errGoalName: "Bitte geben Sie einen Zielnamen ein.", errTarget: "Bitte geben Sie einen Zielwert größer als 0 ein.", errProgress: "Fortschritt darf nicht negativ sein.",
    genericError: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    recurrenceLabel: "Wiederholung", recurrenceOnce: "Einmalig", recurrenceMonthly: "Monatlich", recurrenceYearly: "Jährlich",
    receiptLabel: "Beleg (PDF/Bild)", receiptAttached: "Ein Beleg ist angehängt. Wählen Sie eine Datei zum Ersetzen.", viewReceipt: "Beleg ansehen",
  },
  fr: {
    finquantaId: "ID Finquanta", yourName: "Votre nom", editNameTitle: "Cliquez pour modifier votre nom",
    reminders: "Rappels", addReminderPlaceholder: "Ajouter un rappel…", add: "Ajouter", noReminders: "Aucun rappel pour l'instant. Ajoutez-en un ci-dessus.",
    restore: "Restaurer", clear: "Effacer", recentlyDeleted: "Récemment supprimé", deleted: "Supprimé", undo: "Annuler",
    goalPromptTitle: "Où en sont vos objectifs ?", goalPromptBody: "Vous n'avez pas mis à jour vos objectifs depuis un moment. Voulez-vous enregistrer votre progression ?", updateGoals: "Mettre à jour les objectifs", later: "Plus tard",
    rangeDay: "Jour", rangeMonth: "Mois", rangeYear: "Année", loading: "Chargement…",
    editBookkeeping: "Modifier les données comptables", enterBookkeeping: "Saisir les données comptables",
    invoiceNameLabel: "Nom de la facture", invoiceNamePlaceholder: "Facture ici", invoiceDescriptionLabel: "Description de la facture", invoiceDescriptionPlaceholder: "Texte ici",
    invoiceAmountLabel: "Montant de la facture", enterValue: "Entrer une valeur", invoiceTypeLabel: "Type de facture", dateOfInvoiceLabel: "Date de la facture",
    saveChanges: "Enregistrer les modifications", enterData: "Saisir les données", saving: "Enregistrement…",
    errInvoiceName: "Veuillez saisir un nom de facture.", errAmount: "Veuillez saisir un montant supérieur à 0.", errDate: "Veuillez choisir une date.",
    editGoalTitle: "Modifier l'objectif", enterGoalTitle: "Saisir un objectif", goalLabel: "Objectif", goalPlaceholder: "ex. Conclure une vente immobilière, Réaliser 10 ventes de produits",
    targetLabel: "Cible", targetPlaceholder: "ex. 1 pour un objectif oui/non, 10 pour 10 ventes, 5000 pour économiser 5000", progressLabel: "Progression à ce jour",
    errGoalName: "Veuillez saisir un nom d'objectif.", errTarget: "Veuillez saisir une cible supérieure à 0.", errProgress: "La progression ne peut pas être négative.",
    genericError: "Une erreur s'est produite. Veuillez réessayer.",
    recurrenceLabel: "Récurrence", recurrenceOnce: "Ponctuel", recurrenceMonthly: "Mensuel", recurrenceYearly: "Annuel",
    receiptLabel: "Reçu (PDF/image)", receiptAttached: "Un reçu est joint. Choisissez un fichier pour le remplacer.", viewReceipt: "Voir le reçu",
  },
  es: {
    finquantaId: "ID de Finquanta", yourName: "Tu nombre", editNameTitle: "Haz clic para editar tu nombre",
    reminders: "Recordatorios", addReminderPlaceholder: "Agregar un recordatorio…", add: "Agregar", noReminders: "Aún no hay recordatorios. Agrega uno arriba.",
    restore: "Restaurar", clear: "Borrar", recentlyDeleted: "Eliminado recientemente", deleted: "Eliminado", undo: "Deshacer",
    goalPromptTitle: "¿Cómo van tus objetivos?", goalPromptBody: "Hace un tiempo que no actualizas tus objetivos. ¿Quieres registrar tu progreso?", updateGoals: "Actualizar objetivos", later: "Más tarde",
    rangeDay: "Día", rangeMonth: "Mes", rangeYear: "Año", loading: "Cargando…",
    editBookkeeping: "Editar datos contables", enterBookkeeping: "Ingresar datos contables",
    invoiceNameLabel: "Nombre de factura", invoiceNamePlaceholder: "Factura aquí", invoiceDescriptionLabel: "Descripción de factura", invoiceDescriptionPlaceholder: "Texto aquí",
    invoiceAmountLabel: "Monto de factura", enterValue: "Ingresar valor", invoiceTypeLabel: "Tipo de factura", dateOfInvoiceLabel: "Fecha de factura",
    saveChanges: "Guardar cambios", enterData: "Ingresar datos", saving: "Guardando…",
    errInvoiceName: "Ingresa un nombre de factura.", errAmount: "Ingresa un monto mayor que 0.", errDate: "Elige una fecha.",
    editGoalTitle: "Editar objetivo", enterGoalTitle: "Ingresar objetivo", goalLabel: "Objetivo", goalPlaceholder: "ej. Cerrar un trato inmobiliario, Lograr 10 ventas de producto",
    targetLabel: "Meta", targetPlaceholder: "ej. 1 para un objetivo sí/no, 10 para 10 ventas, 5000 para ahorrar 5000", progressLabel: "Progreso hasta ahora",
    errGoalName: "Ingresa un nombre de objetivo.", errTarget: "Ingresa una meta mayor que 0.", errProgress: "El progreso no puede ser negativo.",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    recurrenceLabel: "Recurrencia", recurrenceOnce: "Una vez", recurrenceMonthly: "Mensual", recurrenceYearly: "Anual",
    receiptLabel: "Recibo (PDF/imagen)", receiptAttached: "Ya hay un recibo adjunto. Elige un archivo para reemplazarlo.", viewReceipt: "Ver recibo",
  },
  pt: {
    finquantaId: "ID Finquanta", yourName: "Seu nome", editNameTitle: "Clique para editar seu nome",
    reminders: "Lembretes", addReminderPlaceholder: "Adicionar um lembrete…", add: "Adicionar", noReminders: "Ainda não há lembretes. Adicione um acima.",
    restore: "Restaurar", clear: "Limpar", recentlyDeleted: "Excluído recentemente", deleted: "Excluído", undo: "Desfazer",
    goalPromptTitle: "Como estão suas metas?", goalPromptBody: "Você não atualiza suas metas há um tempo. Quer registrar seu progresso?", updateGoals: "Atualizar metas", later: "Mais tarde",
    rangeDay: "Dia", rangeMonth: "Mês", rangeYear: "Ano", loading: "Carregando…",
    editBookkeeping: "Editar dados contábeis", enterBookkeeping: "Inserir dados contábeis",
    invoiceNameLabel: "Nome da fatura", invoiceNamePlaceholder: "Fatura aqui", invoiceDescriptionLabel: "Descrição da fatura", invoiceDescriptionPlaceholder: "Texto aqui",
    invoiceAmountLabel: "Valor da fatura", enterValue: "Inserir valor", invoiceTypeLabel: "Tipo de fatura", dateOfInvoiceLabel: "Data da fatura",
    saveChanges: "Salvar alterações", enterData: "Inserir dados", saving: "Salvando…",
    errInvoiceName: "Insira um nome de fatura.", errAmount: "Insira um valor maior que 0.", errDate: "Escolha uma data.",
    editGoalTitle: "Editar meta", enterGoalTitle: "Inserir meta", goalLabel: "Meta", goalPlaceholder: "ex. Fechar um negócio imobiliário, Conseguir 10 vendas de produto",
    targetLabel: "Alvo", targetPlaceholder: "ex. 1 para uma meta sim/não, 10 para 10 vendas, 5000 para economizar 5000", progressLabel: "Progresso até agora",
    errGoalName: "Insira um nome de meta.", errTarget: "Insira um alvo maior que 0.", errProgress: "O progresso não pode ser negativo.",
    genericError: "Algo deu errado. Tente novamente.",
    recurrenceLabel: "Recorrência", recurrenceOnce: "Única", recurrenceMonthly: "Mensal", recurrenceYearly: "Anual",
    receiptLabel: "Recibo (PDF/imagem)", receiptAttached: "Um recibo está anexado. Escolha um arquivo para substituir.", viewReceipt: "Ver recibo",
  },
  ar: {
    finquantaId: "معرّف Finquanta", yourName: "اسمك", editNameTitle: "انقر لتعديل اسمك",
    reminders: "التذكيرات", addReminderPlaceholder: "أضف تذكيرا…", add: "إضافة", noReminders: "لا توجد تذكيرات بعد. أضف واحدا أعلاه.",
    restore: "استعادة", clear: "مسح", recentlyDeleted: "المحذوف مؤخرا", deleted: "تم الحذف", undo: "تراجع",
    goalPromptTitle: "كيف تسير أهدافك؟", goalPromptBody: "لم تقم بتحديث أهدافك منذ فترة. هل تريد تسجيل تقدمك؟", updateGoals: "تحديث الأهداف", later: "لاحقا",
    rangeDay: "يوم", rangeMonth: "شهر", rangeYear: "سنة", loading: "جار التحميل…",
    editBookkeeping: "تعديل بيانات المحاسبة", enterBookkeeping: "إدخال بيانات المحاسبة",
    invoiceNameLabel: "اسم الفاتورة", invoiceNamePlaceholder: "الفاتورة هنا", invoiceDescriptionLabel: "وصف الفاتورة", invoiceDescriptionPlaceholder: "النص هنا",
    invoiceAmountLabel: "مبلغ الفاتورة", enterValue: "أدخل القيمة", invoiceTypeLabel: "نوع الفاتورة", dateOfInvoiceLabel: "تاريخ الفاتورة",
    saveChanges: "حفظ التغييرات", enterData: "إدخال البيانات", saving: "جار الحفظ…",
    errInvoiceName: "يرجى إدخال اسم الفاتورة.", errAmount: "يرجى إدخال مبلغ أكبر من 0.", errDate: "يرجى اختيار تاريخ.",
    editGoalTitle: "تعديل الهدف", enterGoalTitle: "إدخال هدف", goalLabel: "الهدف", goalPlaceholder: "مثال: إتمام صفقة عقارية، تحقيق 10 مبيعات للمنتج",
    targetLabel: "المستهدف", targetPlaceholder: "مثال: 1 لهدف نعم/لا، 10 لـ 10 مبيعات، 5000 لتوفير 5000", progressLabel: "التقدم حتى الآن",
    errGoalName: "يرجى إدخال اسم الهدف.", errTarget: "يرجى إدخال مستهدف أكبر من 0.", errProgress: "لا يمكن أن يكون التقدم سالبا.",
    genericError: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    recurrenceLabel: "التكرار", recurrenceOnce: "مرة واحدة", recurrenceMonthly: "شهري", recurrenceYearly: "سنوي",
    receiptLabel: "إيصال (PDF/صورة)", receiptAttached: "تم إرفاق إيصال. اختر ملفا لاستبداله.", viewReceipt: "عرض الإيصال",
  },
  zh: {
    finquantaId: "Finquanta ID", yourName: "您的姓名", editNameTitle: "点击编辑您的姓名",
    reminders: "提醒", addReminderPlaceholder: "添加提醒…", add: "添加", noReminders: "还没有提醒。在上面添加一个。",
    restore: "恢复", clear: "清除", recentlyDeleted: "最近删除", deleted: "已删除", undo: "撤销",
    goalPromptTitle: "您的目标进展如何？", goalPromptBody: "您有一段时间没有更新目标了。想记录您的进度吗？", updateGoals: "更新目标", later: "稍后",
    rangeDay: "日", rangeMonth: "月", rangeYear: "年", loading: "加载中…",
    editBookkeeping: "编辑簿记数据", enterBookkeeping: "输入簿记数据",
    invoiceNameLabel: "发票名称", invoiceNamePlaceholder: "发票", invoiceDescriptionLabel: "发票描述", invoiceDescriptionPlaceholder: "文本",
    invoiceAmountLabel: "发票金额", enterValue: "输入数值", invoiceTypeLabel: "发票类型", dateOfInvoiceLabel: "发票日期",
    saveChanges: "保存更改", enterData: "输入数据", saving: "保存中…",
    errInvoiceName: "请输入发票名称。", errAmount: "请输入大于0的金额。", errDate: "请选择日期。",
    editGoalTitle: "编辑目标", enterGoalTitle: "输入目标", goalLabel: "目标", goalPlaceholder: "例如：完成一笔房地产交易、获得10笔产品销售",
    targetLabel: "目标值", targetPlaceholder: "例如：是/否目标填1，10笔销售填10，存5000填5000", progressLabel: "目前进度",
    errGoalName: "请输入目标名称。", errTarget: "请输入大于0的目标值。", errProgress: "进度不能为负。",
    genericError: "出了点问题。请重试。",
    recurrenceLabel: "重复", recurrenceOnce: "一次性", recurrenceMonthly: "每月", recurrenceYearly: "每年",
    receiptLabel: "收据（PDF/图片）", receiptAttached: "已附加收据。选择文件以替换。", viewReceipt: "查看收据",
  },
  ja: {
    finquantaId: "Finquanta ID", yourName: "お名前", editNameTitle: "クリックして名前を編集",
    reminders: "リマインダー", addReminderPlaceholder: "リマインダーを追加…", add: "追加", noReminders: "リマインダーはまだありません。上で追加してください。",
    restore: "復元", clear: "クリア", recentlyDeleted: "最近削除した項目", deleted: "削除しました", undo: "元に戻す",
    goalPromptTitle: "目標の進み具合はいかがですか？", goalPromptBody: "しばらく目標を更新していません。進捗を記録しますか？", updateGoals: "目標を更新", later: "後で",
    rangeDay: "日", rangeMonth: "月", rangeYear: "年", loading: "読み込み中…",
    editBookkeeping: "簿記データを編集", enterBookkeeping: "簿記データを入力",
    invoiceNameLabel: "請求書名", invoiceNamePlaceholder: "請求書", invoiceDescriptionLabel: "請求書の説明", invoiceDescriptionPlaceholder: "テキスト",
    invoiceAmountLabel: "請求金額", enterValue: "値を入力", invoiceTypeLabel: "請求書の種類", dateOfInvoiceLabel: "請求日",
    saveChanges: "変更を保存", enterData: "データを入力", saving: "保存中…",
    errInvoiceName: "請求書名を入力してください。", errAmount: "0より大きい金額を入力してください。", errDate: "日付を選択してください。",
    editGoalTitle: "目標を編集", enterGoalTitle: "目標を入力", goalLabel: "目標", goalPlaceholder: "例：不動産取引の成立、製品10件の販売",
    targetLabel: "目標値", targetPlaceholder: "例：はい/いいえの目標は1、10件の販売は10、5000を貯めるなら5000", progressLabel: "これまでの進捗",
    errGoalName: "目標名を入力してください。", errTarget: "0より大きい目標値を入力してください。", errProgress: "進捗をマイナスにはできません。",
    genericError: "問題が発生しました。もう一度お試しください。",
    recurrenceLabel: "繰り返し", recurrenceOnce: "1回のみ", recurrenceMonthly: "毎月", recurrenceYearly: "毎年",
    receiptLabel: "領収書（PDF/画像）", receiptAttached: "領収書が添付されています。置き換えるファイルを選択してください。", viewReceipt: "領収書を見る",
  },
  ru: {
    finquantaId: "ID Finquanta", yourName: "Ваше имя", editNameTitle: "Нажмите, чтобы изменить имя",
    reminders: "Напоминания", addReminderPlaceholder: "Добавить напоминание…", add: "Добавить", noReminders: "Пока нет напоминаний. Добавьте выше.",
    restore: "Восстановить", clear: "Очистить", recentlyDeleted: "Недавно удалённые", deleted: "Удалено", undo: "Отменить",
    goalPromptTitle: "Как продвигаются ваши цели?", goalPromptBody: "Вы давно не обновляли свои цели. Хотите записать прогресс?", updateGoals: "Обновить цели", later: "Позже",
    rangeDay: "День", rangeMonth: "Месяц", rangeYear: "Год", loading: "Загрузка…",
    editBookkeeping: "Изменить бухгалтерские данные", enterBookkeeping: "Ввести бухгалтерские данные",
    invoiceNameLabel: "Название счёта", invoiceNamePlaceholder: "Счёт здесь", invoiceDescriptionLabel: "Описание счёта", invoiceDescriptionPlaceholder: "Текст здесь",
    invoiceAmountLabel: "Сумма счёта", enterValue: "Введите значение", invoiceTypeLabel: "Тип счёта", dateOfInvoiceLabel: "Дата счёта",
    saveChanges: "Сохранить изменения", enterData: "Ввести данные", saving: "Сохранение…",
    errInvoiceName: "Введите название счёта.", errAmount: "Введите сумму больше 0.", errDate: "Выберите дату.",
    editGoalTitle: "Изменить цель", enterGoalTitle: "Ввести цель", goalLabel: "Цель", goalPlaceholder: "напр. Закрыть сделку с недвижимостью, Получить 10 продаж",
    targetLabel: "Цель (значение)", targetPlaceholder: "напр. 1 для цели да/нет, 10 для 10 продаж, 5000 чтобы накопить 5000", progressLabel: "Текущий прогресс",
    errGoalName: "Введите название цели.", errTarget: "Введите значение больше 0.", errProgress: "Прогресс не может быть отрицательным.",
    genericError: "Что-то пошло не так. Повторите попытку.",
    recurrenceLabel: "Повторение", recurrenceOnce: "Разово", recurrenceMonthly: "Ежемесячно", recurrenceYearly: "Ежегодно",
    receiptLabel: "Чек (PDF/изображение)", receiptAttached: "Чек прикреплён. Выберите файл для замены.", viewReceipt: "Посмотреть чек",
  },
};

// Summary-card period selector labels (last30Days already exists per language).
const dashboardPeriods: Record<string, Record<string, string>> = {
  en: { allTime: "All time", threeMonths: "3 months", periodMonth: "Month" },
  nl: { allTime: "Alle tijd", threeMonths: "3 maanden", periodMonth: "Maand" },
  de: { allTime: "Gesamte Zeit", threeMonths: "3 Monate", periodMonth: "Monat" },
  fr: { allTime: "Tout le temps", threeMonths: "3 mois", periodMonth: "Mois" },
  es: { allTime: "Todo el tiempo", threeMonths: "3 meses", periodMonth: "Mes" },
  pt: { allTime: "Todo o período", threeMonths: "3 meses", periodMonth: "Mês" },
  ar: { allTime: "كل الوقت", threeMonths: "3 أشهر", periodMonth: "شهر" },
  zh: { allTime: "全部时间", threeMonths: "3个月", periodMonth: "月份" },
  ja: { allTime: "全期間", threeMonths: "3か月", periodMonth: "月" },
  ru: { allTime: "За всё время", threeMonths: "3 месяца", periodMonth: "Месяц" },
};

for (const lang of Object.keys(translations)) {
  translations[lang].dashboard = {
    ...translations[lang].dashboard,
    ...(dashboardExtra[lang] ?? dashboardExtra.en),
    ...(dashboardPeriods[lang] ?? dashboardPeriods.en),
  };
}

// Onboarding wizard strings (one-question-at-a-time flow). {current}/{total} are
// replaced in the component. Select option VALUES stay in English (they're stored).
const onboardingStrings: Record<string, Record<string, string>> = {
  en: { skip: "Skip for now", progress: "Question {current} of {total}", back: "Back", continue: "Continue", finish: "Finish", saving: "Saving…", enterHint: "Press Enter ↵ to continue", required: "This one's required to continue.", saveError: "Could not save. Please try again.", qBusinessName: "What's your business name?", qBusinessType: "What type of business is it?", qIndustry: "What industry are you in?", qNiche: "What's your business niche?", qEntity: "What's your business structure?", qCountry: "What country are you based in?", qIncorporation: "Where is your business incorporated?", qMaturity: "What stage is your business at?", qRevenue: "What's your revenue range?", qEmployees: "How many people work in the business?", qGoals: "What are your financial goals?", hintNiche: "Get specific — it helps us tailor things.", hintIncorporation: "State / region / country of incorporation.", hintGoals: "A sentence or two is plenty." },
  nl: { skip: "Voor nu overslaan", progress: "Vraag {current} van {total}", back: "Terug", continue: "Doorgaan", finish: "Voltooien", saving: "Opslaan…", enterHint: "Druk op Enter ↵ om door te gaan", required: "Dit is verplicht om door te gaan.", saveError: "Kon niet opslaan. Probeer het opnieuw.", qBusinessName: "Wat is de naam van uw bedrijf?", qBusinessType: "Wat voor soort bedrijf is het?", qIndustry: "In welke branche zit u?", qNiche: "Wat is uw bedrijfsniche?", qEntity: "Wat is uw bedrijfsstructuur?", qCountry: "In welk land bent u gevestigd?", qIncorporation: "Waar is uw bedrijf opgericht?", qMaturity: "In welke fase bevindt uw bedrijf zich?", qRevenue: "Wat is uw omzetbereik?", qEmployees: "Hoeveel mensen werken er in het bedrijf?", qGoals: "Wat zijn uw financiële doelen?", hintNiche: "Wees specifiek — dit helpt ons om alles af te stemmen.", hintIncorporation: "Staat / regio / land van oprichting.", hintGoals: "Een zin of twee is voldoende." },
  de: { skip: "Vorerst überspringen", progress: "Frage {current} von {total}", back: "Zurück", continue: "Weiter", finish: "Fertig", saving: "Speichern…", enterHint: "Drücken Sie Enter ↵, um fortzufahren", required: "Dies ist erforderlich, um fortzufahren.", saveError: "Speichern fehlgeschlagen. Bitte erneut versuchen.", qBusinessName: "Wie heißt Ihr Unternehmen?", qBusinessType: "Welche Art von Unternehmen ist es?", qIndustry: "In welcher Branche sind Sie tätig?", qNiche: "Was ist Ihre Geschäftsnische?", qEntity: "Was ist Ihre Unternehmensform?", qCountry: "In welchem Land sind Sie ansässig?", qIncorporation: "Wo ist Ihr Unternehmen eingetragen?", qMaturity: "In welcher Phase befindet sich Ihr Unternehmen?", qRevenue: "Wie hoch ist Ihr Umsatzbereich?", qEmployees: "Wie viele Personen arbeiten im Unternehmen?", qGoals: "Was sind Ihre finanziellen Ziele?", hintNiche: "Seien Sie konkret — das hilft uns bei der Anpassung.", hintIncorporation: "Bundesland / Region / Land der Gründung.", hintGoals: "Ein oder zwei Sätze genügen." },
  fr: { skip: "Ignorer pour l'instant", progress: "Question {current} sur {total}", back: "Retour", continue: "Continuer", finish: "Terminer", saving: "Enregistrement…", enterHint: "Appuyez sur Entrée ↵ pour continuer", required: "Ce champ est requis pour continuer.", saveError: "Échec de l'enregistrement. Veuillez réessayer.", qBusinessName: "Quel est le nom de votre entreprise ?", qBusinessType: "Quel type d'entreprise est-ce ?", qIndustry: "Dans quel secteur êtes-vous ?", qNiche: "Quelle est la niche de votre entreprise ?", qEntity: "Quelle est la structure de votre entreprise ?", qCountry: "Dans quel pays êtes-vous basé ?", qIncorporation: "Où votre entreprise est-elle constituée ?", qMaturity: "À quel stade se trouve votre entreprise ?", qRevenue: "Quelle est votre fourchette de revenus ?", qEmployees: "Combien de personnes travaillent dans l'entreprise ?", qGoals: "Quels sont vos objectifs financiers ?", hintNiche: "Soyez précis — cela nous aide à personnaliser.", hintIncorporation: "État / région / pays de constitution.", hintGoals: "Une phrase ou deux suffisent." },
  es: { skip: "Omitir por ahora", progress: "Pregunta {current} de {total}", back: "Atrás", continue: "Continuar", finish: "Finalizar", saving: "Guardando…", enterHint: "Pulsa Enter ↵ para continuar", required: "Esto es obligatorio para continuar.", saveError: "No se pudo guardar. Inténtalo de nuevo.", qBusinessName: "¿Cuál es el nombre de tu empresa?", qBusinessType: "¿Qué tipo de empresa es?", qIndustry: "¿En qué sector estás?", qNiche: "¿Cuál es el nicho de tu empresa?", qEntity: "¿Cuál es la estructura de tu empresa?", qCountry: "¿En qué país te encuentras?", qIncorporation: "¿Dónde está constituida tu empresa?", qMaturity: "¿En qué etapa está tu empresa?", qRevenue: "¿Cuál es tu rango de ingresos?", qEmployees: "¿Cuántas personas trabajan en la empresa?", qGoals: "¿Cuáles son tus objetivos financieros?", hintNiche: "Sé específico — nos ayuda a personalizar.", hintIncorporation: "Estado / región / país de constitución.", hintGoals: "Una o dos frases son suficientes." },
  pt: { skip: "Pular por agora", progress: "Pergunta {current} de {total}", back: "Voltar", continue: "Continuar", finish: "Concluir", saving: "Salvando…", enterHint: "Pressione Enter ↵ para continuar", required: "Isto é obrigatório para continuar.", saveError: "Não foi possível salvar. Tente novamente.", qBusinessName: "Qual é o nome da sua empresa?", qBusinessType: "Que tipo de empresa é?", qIndustry: "Em que setor você está?", qNiche: "Qual é o nicho da sua empresa?", qEntity: "Qual é a estrutura da sua empresa?", qCountry: "Em que país você está?", qIncorporation: "Onde a sua empresa está registrada?", qMaturity: "Em que estágio está a sua empresa?", qRevenue: "Qual é a sua faixa de receita?", qEmployees: "Quantas pessoas trabalham na empresa?", qGoals: "Quais são os seus objetivos financeiros?", hintNiche: "Seja específico — ajuda-nos a personalizar.", hintIncorporation: "Estado / região / país de registro.", hintGoals: "Uma ou duas frases são suficientes." },
  ar: { skip: "تخطَّ الآن", progress: "السؤال {current} من {total}", back: "رجوع", continue: "متابعة", finish: "إنهاء", saving: "جارٍ الحفظ…", enterHint: "اضغط Enter ↵ للمتابعة", required: "هذا الحقل مطلوب للمتابعة.", saveError: "تعذّر الحفظ. حاول مرة أخرى.", qBusinessName: "ما اسم شركتك؟", qBusinessType: "ما نوع الشركة؟", qIndustry: "في أي قطاع تعمل؟", qNiche: "ما هو تخصص شركتك؟", qEntity: "ما هو الهيكل القانوني لشركتك؟", qCountry: "في أي بلد تتواجد؟", qIncorporation: "أين تأسست شركتك؟", qMaturity: "في أي مرحلة شركتك؟", qRevenue: "ما نطاق إيراداتك؟", qEmployees: "كم عدد العاملين في الشركة؟", qGoals: "ما هي أهدافك المالية؟", hintNiche: "كن محدداً — فهذا يساعدنا على التخصيص.", hintIncorporation: "الولاية / المنطقة / بلد التأسيس.", hintGoals: "جملة أو جملتان تكفيان." },
  zh: { skip: "暂时跳过", progress: "第 {current} 个问题，共 {total} 个", back: "返回", continue: "继续", finish: "完成", saving: "保存中…", enterHint: "按 Enter ↵ 继续", required: "此项为必填项。", saveError: "无法保存，请重试。", qBusinessName: "您的公司名称是什么？", qBusinessType: "这是什么类型的企业？", qIndustry: "您从事哪个行业？", qNiche: "您的业务定位是什么？", qEntity: "您的企业结构是什么？", qCountry: "您位于哪个国家？", qIncorporation: "您的公司在哪里注册？", qMaturity: "您的企业处于哪个阶段？", qRevenue: "您的营收范围是多少？", qEmployees: "公司有多少人？", qGoals: "您的财务目标是什么？", hintNiche: "请具体说明——这有助于我们为您定制。", hintIncorporation: "注册的州/地区/国家。", hintGoals: "一两句话即可。" },
  ja: { skip: "後でスキップ", progress: "質問 {current} / {total}", back: "戻る", continue: "続ける", finish: "完了", saving: "保存中…", enterHint: "Enter ↵ で次へ", required: "この項目は必須です。", saveError: "保存できませんでした。もう一度お試しください。", qBusinessName: "ビジネス名は何ですか？", qBusinessType: "どんな種類のビジネスですか？", qIndustry: "どの業界ですか？", qNiche: "ビジネスのニッチは何ですか？", qEntity: "事業形態は何ですか？", qCountry: "どの国を拠点としていますか？", qIncorporation: "ビジネスはどこで設立されましたか？", qMaturity: "ビジネスはどの段階ですか？", qRevenue: "売上の範囲はどのくらいですか？", qEmployees: "何人が働いていますか？", qGoals: "財務上の目標は何ですか？", hintNiche: "具体的に — カスタマイズに役立ちます。", hintIncorporation: "設立した州/地域/国。", hintGoals: "一言二言で十分です。" },
  ru: { skip: "Пропустить пока", progress: "Вопрос {current} из {total}", back: "Назад", continue: "Продолжить", finish: "Готово", saving: "Сохранение…", enterHint: "Нажмите Enter ↵, чтобы продолжить", required: "Это поле обязательно для продолжения.", saveError: "Не удалось сохранить. Попробуйте ещё раз.", qBusinessName: "Как называется ваш бизнес?", qBusinessType: "Какой это тип бизнеса?", qIndustry: "В какой отрасли вы работаете?", qNiche: "Какова ниша вашего бизнеса?", qEntity: "Какова структура вашего бизнеса?", qCountry: "В какой стране вы находитесь?", qIncorporation: "Где зарегистрирован ваш бизнес?", qMaturity: "На какой стадии ваш бизнес?", qRevenue: "Каков ваш диапазон дохода?", qEmployees: "Сколько человек работает в бизнесе?", qGoals: "Каковы ваши финансовые цели?", hintNiche: "Будьте конкретны — это помогает нам адаптировать.", hintIncorporation: "Штат / регион / страна регистрации.", hintGoals: "Одного-двух предложений достаточно." },
};

// Business Profile section in Profile Settings (merged into the `settings` namespace).
const settingsExtra: Record<string, Record<string, string>> = {
  en: { bizProfile: "Business Profile", bizProfileDesc: "The details you entered during onboarding. Update them any time — they’re saved to your account.", fBusinessName: "Business name", fBusinessType: "Business type", fIndustry: "Industry", fNiche: "Business niche", fStructure: "Business structure", fCountry: "Country", fPlaceOfIncorporation: "Place of incorporation", fMaturityStage: "Maturity stage", fRevenueRange: "Revenue range", fEmployees: "Employees", fFinancialGoals: "Financial goals", bizSaved: "Saved ✓", selectOption: "Select…" },
  nl: { bizProfile: "Bedrijfsprofiel", bizProfileDesc: "De gegevens die u tijdens de onboarding hebt ingevoerd. Werk ze altijd bij — ze worden in uw account opgeslagen.", fBusinessName: "Bedrijfsnaam", fBusinessType: "Bedrijfstype", fIndustry: "Branche", fNiche: "Bedrijfsniche", fStructure: "Bedrijfsstructuur", fCountry: "Land", fPlaceOfIncorporation: "Plaats van oprichting", fMaturityStage: "Volwassenheidsfase", fRevenueRange: "Omzetbereik", fEmployees: "Medewerkers", fFinancialGoals: "Financiële doelen", bizSaved: "Opgeslagen ✓", selectOption: "Selecteer…" },
  de: { bizProfile: "Unternehmensprofil", bizProfileDesc: "Die Angaben aus dem Onboarding. Sie können sie jederzeit aktualisieren — sie werden in Ihrem Konto gespeichert.", fBusinessName: "Unternehmensname", fBusinessType: "Unternehmenstyp", fIndustry: "Branche", fNiche: "Geschäftsnische", fStructure: "Unternehmensform", fCountry: "Land", fPlaceOfIncorporation: "Ort der Gründung", fMaturityStage: "Reifephase", fRevenueRange: "Umsatzbereich", fEmployees: "Mitarbeiter", fFinancialGoals: "Finanzielle Ziele", bizSaved: "Gespeichert ✓", selectOption: "Auswählen…" },
  fr: { bizProfile: "Profil de l'entreprise", bizProfileDesc: "Les informations saisies lors de l'intégration. Modifiez-les à tout moment — elles sont enregistrées dans votre compte.", fBusinessName: "Nom de l'entreprise", fBusinessType: "Type d'entreprise", fIndustry: "Secteur", fNiche: "Niche de l'entreprise", fStructure: "Structure de l'entreprise", fCountry: "Pays", fPlaceOfIncorporation: "Lieu de constitution", fMaturityStage: "Stade de maturité", fRevenueRange: "Fourchette de revenus", fEmployees: "Employés", fFinancialGoals: "Objectifs financiers", bizSaved: "Enregistré ✓", selectOption: "Sélectionner…" },
  es: { bizProfile: "Perfil de empresa", bizProfileDesc: "Los datos que ingresaste durante la incorporación. Actualízalos cuando quieras — se guardan en tu cuenta.", fBusinessName: "Nombre de la empresa", fBusinessType: "Tipo de empresa", fIndustry: "Sector", fNiche: "Nicho de la empresa", fStructure: "Estructura de la empresa", fCountry: "País", fPlaceOfIncorporation: "Lugar de constitución", fMaturityStage: "Etapa de madurez", fRevenueRange: "Rango de ingresos", fEmployees: "Empleados", fFinancialGoals: "Objetivos financieros", bizSaved: "Guardado ✓", selectOption: "Seleccionar…" },
  pt: { bizProfile: "Perfil da empresa", bizProfileDesc: "Os dados que você inseriu durante a integração. Atualize-os quando quiser — são salvos na sua conta.", fBusinessName: "Nome da empresa", fBusinessType: "Tipo de empresa", fIndustry: "Setor", fNiche: "Nicho da empresa", fStructure: "Estrutura da empresa", fCountry: "País", fPlaceOfIncorporation: "Local de registro", fMaturityStage: "Estágio de maturidade", fRevenueRange: "Faixa de receita", fEmployees: "Funcionários", fFinancialGoals: "Objetivos financeiros", bizSaved: "Salvo ✓", selectOption: "Selecionar…" },
  ar: { bizProfile: "ملف الشركة", bizProfileDesc: "التفاصيل التي أدخلتها أثناء الإعداد. يمكنك تحديثها في أي وقت — يتم حفظها في حسابك.", fBusinessName: "اسم الشركة", fBusinessType: "نوع الشركة", fIndustry: "القطاع", fNiche: "تخصص الشركة", fStructure: "الهيكل القانوني", fCountry: "البلد", fPlaceOfIncorporation: "مكان التأسيس", fMaturityStage: "مرحلة النضج", fRevenueRange: "نطاق الإيرادات", fEmployees: "الموظفون", fFinancialGoals: "الأهداف المالية", bizSaved: "تم الحفظ ✓", selectOption: "اختر…" },
  zh: { bizProfile: "企业资料", bizProfileDesc: "您在入门时填写的信息。可随时更新——这些信息会保存到您的账户。", fBusinessName: "公司名称", fBusinessType: "企业类型", fIndustry: "行业", fNiche: "业务定位", fStructure: "企业结构", fCountry: "国家", fPlaceOfIncorporation: "注册地", fMaturityStage: "成熟阶段", fRevenueRange: "营收范围", fEmployees: "员工人数", fFinancialGoals: "财务目标", bizSaved: "已保存 ✓", selectOption: "请选择…" },
  ja: { bizProfile: "ビジネスプロフィール", bizProfileDesc: "オンボーディングで入力した情報です。いつでも更新でき、アカウントに保存されます。", fBusinessName: "ビジネス名", fBusinessType: "ビジネスの種類", fIndustry: "業界", fNiche: "ビジネスのニッチ", fStructure: "事業形態", fCountry: "国", fPlaceOfIncorporation: "設立地", fMaturityStage: "成熟段階", fRevenueRange: "売上範囲", fEmployees: "従業員数", fFinancialGoals: "財務目標", bizSaved: "保存しました ✓", selectOption: "選択…" },
  ru: { bizProfile: "Профиль бизнеса", bizProfileDesc: "Данные, введённые при онбординге. Обновляйте их в любое время — они сохраняются в вашем аккаунте.", fBusinessName: "Название бизнеса", fBusinessType: "Тип бизнеса", fIndustry: "Отрасль", fNiche: "Ниша бизнеса", fStructure: "Структура бизнеса", fCountry: "Страна", fPlaceOfIncorporation: "Место регистрации", fMaturityStage: "Стадия зрелости", fRevenueRange: "Диапазон дохода", fEmployees: "Сотрудники", fFinancialGoals: "Финансовые цели", bizSaved: "Сохранено ✓", selectOption: "Выберите…" },
};

for (const lang of Object.keys(translations)) {
  translations[lang].onboarding = { ...(onboardingStrings[lang] ?? onboardingStrings.en) };
  translations[lang].settings = { ...translations[lang].settings, ...(settingsExtra[lang] ?? settingsExtra.en) };
}

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (section: string, key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('finquanta_language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguageState(savedLanguage);
    }
    setHydrated(true);
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('finquanta_language', lang);
  };

  const t = (section: string, key: string): string => {
    const lang = hydrated ? language : 'en';
    return translations[lang]?.[section]?.[key] || translations['en']?.[section]?.[key] || `${section}.${key}`;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}