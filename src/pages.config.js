/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIFinancialAnalysis from './pages/AIFinancialAnalysis';
import AIGuidelines from './pages/AIGuidelines';
import AccountingData from './pages/AccountingData';
import ActivityLog from './pages/ActivityLog';
import AllBranchesDashboard from './pages/AllBranchesDashboard';
import Announcements from './pages/Announcements';
import BannerManagement from './pages/BannerManagement';
import BookingReceipt from './pages/BookingReceipt';
import Bookings from './pages/Bookings';
import BranchManagement from './pages/BranchManagement';
import BranchSelection from './pages/BranchSelection';
import ContractEditor from './pages/ContractEditor';
import ContractTemplate from './pages/ContractTemplate';
import Contracts from './pages/Contracts';
import CronJobDashboard from './pages/CronJobDashboard';
import CronJobSettings from './pages/CronJobSettings';
import CustomTestDataGenerator from './pages/CustomTestDataGenerator';
import Dashboard from './pages/Dashboard';
import DataArchive from './pages/DataArchive';
import DataLists from './pages/DataLists';
import DeveloperGuide from './pages/DeveloperGuide';
import Expenses from './pages/Expenses';
import FacebookScreencastGuide from './pages/FacebookScreencastGuide';
import FacebookSetupGuide from './pages/FacebookSetupGuide';
import FacebookTestDemo from './pages/FacebookTestDemo';
import Home from './pages/Home';
import Invoice from './pages/Invoice';
import LineConnect from './pages/LineConnect';
import Maintenance from './pages/Maintenance';
import Materials from './pages/Materials';
import MeterReadings from './pages/MeterReadings';
import NoPackagePage from './pages/NoPackagePage';
import NotificationSettings from './pages/NotificationSettings';
import OwnerAI from './pages/OwnerAI';
import PackagePaymentPage from './pages/PackagePaymentPage';
import PackageSelection from './pages/PackageSelection';
import Payments from './pages/Payments';
import PrintReceipts from './pages/PrintReceipts';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PublicInvoice from './pages/PublicInvoice';
import PublicReceipt from './pages/PublicReceipt';
import Receipt from './pages/Receipt';
import Rooms from './pages/Rooms';
import Settings from './pages/Settings';
import SupportTickets from './pages/SupportTickets';
import SystemAssistant from './pages/SystemAssistant';
import Tenants from './pages/Tenants';
import TestInvoiceGeneration from './pages/TestInvoiceGeneration';
import TestLine from './pages/TestLine';
import TestingAdmin from './pages/TestingAdmin';
import TestingSMS from './pages/TestingSMS';
import TrialExpiredPage from './pages/TrialExpiredPage';
import UpdateMyBranches from './pages/UpdateMyBranches';
import UserBranchAccess from './pages/UserBranchAccess';
import UsersDashboard from './pages/UsersDashboard';
import WebhookLogs from './pages/WebhookLogs';
import Welcome from './pages/Welcome';
import f12 from './pages/f12';
import reports from './pages/reports';
import PublicBooking from './pages/PublicBooking';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIFinancialAnalysis": AIFinancialAnalysis,
    "AIGuidelines": AIGuidelines,
    "AccountingData": AccountingData,
    "ActivityLog": ActivityLog,
    "AllBranchesDashboard": AllBranchesDashboard,
    "Announcements": Announcements,
    "BannerManagement": BannerManagement,
    "BookingReceipt": BookingReceipt,
    "Bookings": Bookings,
    "BranchManagement": BranchManagement,
    "BranchSelection": BranchSelection,
    "ContractEditor": ContractEditor,
    "ContractTemplate": ContractTemplate,
    "Contracts": Contracts,
    "CronJobDashboard": CronJobDashboard,
    "CronJobSettings": CronJobSettings,
    "CustomTestDataGenerator": CustomTestDataGenerator,
    "Dashboard": Dashboard,
    "DataArchive": DataArchive,
    "DataLists": DataLists,
    "DeveloperGuide": DeveloperGuide,
    "Expenses": Expenses,
    "FacebookScreencastGuide": FacebookScreencastGuide,
    "FacebookSetupGuide": FacebookSetupGuide,
    "FacebookTestDemo": FacebookTestDemo,
    "Home": Home,
    "Invoice": Invoice,
    "LineConnect": LineConnect,
    "Maintenance": Maintenance,
    "Materials": Materials,
    "MeterReadings": MeterReadings,
    "NoPackagePage": NoPackagePage,
    "NotificationSettings": NotificationSettings,
    "OwnerAI": OwnerAI,
    "PackagePaymentPage": PackagePaymentPage,
    "PackageSelection": PackageSelection,
    "Payments": Payments,
    "PrintReceipts": PrintReceipts,
    "PrivacyPolicy": PrivacyPolicy,
    "PublicInvoice": PublicInvoice,
    "PublicReceipt": PublicReceipt,
    "Receipt": Receipt,
    "Rooms": Rooms,
    "Settings": Settings,
    "SupportTickets": SupportTickets,
    "SystemAssistant": SystemAssistant,
    "Tenants": Tenants,
    "TestInvoiceGeneration": TestInvoiceGeneration,
    "TestLine": TestLine,
    "TestingAdmin": TestingAdmin,
    "TestingSMS": TestingSMS,
    "TrialExpiredPage": TrialExpiredPage,
    "UpdateMyBranches": UpdateMyBranches,
    "UserBranchAccess": UserBranchAccess,
    "UsersDashboard": UsersDashboard,
    "WebhookLogs": WebhookLogs,
    "Welcome": Welcome,
    "f12": f12,
    "reports": reports,
    "PublicBooking": PublicBooking,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};