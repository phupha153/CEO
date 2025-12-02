import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Tenants from './pages/Tenants';
import Payments from './pages/Payments';
import Maintenance from './pages/Maintenance';
import Expenses from './pages/Expenses';
import MeterReadings from './pages/MeterReadings';
import Settings from './pages/Settings';
import TestLine from './pages/TestLine';
import Invoice from './pages/Invoice';
import TestingAdmin from './pages/TestingAdmin';
import AccountingData from './pages/AccountingData';
import Announcements from './pages/Announcements';
import Receipt from './pages/Receipt';
import PrintReceipts from './pages/PrintReceipts';
import Contracts from './pages/Contracts';
import ContractEditor from './pages/ContractEditor';
import ContractTemplate from './pages/ContractTemplate';
import reports from './pages/reports';
import OwnerAI from './pages/OwnerAI';
import DeveloperGuide from './pages/DeveloperGuide';
import BranchSelection from './pages/BranchSelection';
import BranchManagement from './pages/BranchManagement';
import AllBranchesDashboard from './pages/AllBranchesDashboard';
import TestingSMS from './pages/TestingSMS';
import Materials from './pages/Materials';
import AIGuidelines from './pages/AIGuidelines';
import NotificationSettings from './pages/NotificationSettings';
import DataLists from './pages/DataLists';
import RenewalPage from './pages/RenewalPage';
import SupportTickets from './pages/SupportTickets';
import PackageSettings from './pages/PackageSettings';
import PackageSelectionPage from './pages/PackageSelectionPage';
import TrialExpiredPage from './pages/TrialExpiredPage';
import PackageExpiredPage from './pages/PackageExpiredPage';
import UserBranchAccess from './pages/UserBranchAccess';
import ActivityLog from './pages/ActivityLog';
import DataArchive from './pages/DataArchive';
import UpdateMyBranches from './pages/UpdateMyBranches';
import f12 from './pages/f12';
import AIFinancialAnalysis from './pages/AIFinancialAnalysis';
import CustomTestDataGenerator from './pages/CustomTestDataGenerator';
import BookingReceipt from './pages/BookingReceipt';
import CronJobDashboard from './pages/CronJobDashboard';
import LineConnect from './pages/LineConnect';
import TestInvoiceGeneration from './pages/TestInvoiceGeneration';
import CronJobSettings from './pages/CronJobSettings';
import PublicInvoice from './pages/PublicInvoice';
import FacebookTestDemo from './pages/FacebookTestDemo';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Rooms": Rooms,
    "Bookings": Bookings,
    "Tenants": Tenants,
    "Payments": Payments,
    "Maintenance": Maintenance,
    "Expenses": Expenses,
    "MeterReadings": MeterReadings,
    "Settings": Settings,
    "TestLine": TestLine,
    "Invoice": Invoice,
    "TestingAdmin": TestingAdmin,
    "AccountingData": AccountingData,
    "Announcements": Announcements,
    "Receipt": Receipt,
    "PrintReceipts": PrintReceipts,
    "Contracts": Contracts,
    "ContractEditor": ContractEditor,
    "ContractTemplate": ContractTemplate,
    "reports": reports,
    "OwnerAI": OwnerAI,
    "DeveloperGuide": DeveloperGuide,
    "BranchSelection": BranchSelection,
    "BranchManagement": BranchManagement,
    "AllBranchesDashboard": AllBranchesDashboard,
    "TestingSMS": TestingSMS,
    "Materials": Materials,
    "AIGuidelines": AIGuidelines,
    "NotificationSettings": NotificationSettings,
    "DataLists": DataLists,
    "RenewalPage": RenewalPage,
    "SupportTickets": SupportTickets,
    "PackageSettings": PackageSettings,
    "PackageSelectionPage": PackageSelectionPage,
    "TrialExpiredPage": TrialExpiredPage,
    "PackageExpiredPage": PackageExpiredPage,
    "UserBranchAccess": UserBranchAccess,
    "ActivityLog": ActivityLog,
    "DataArchive": DataArchive,
    "UpdateMyBranches": UpdateMyBranches,
    "f12": f12,
    "AIFinancialAnalysis": AIFinancialAnalysis,
    "CustomTestDataGenerator": CustomTestDataGenerator,
    "BookingReceipt": BookingReceipt,
    "CronJobDashboard": CronJobDashboard,
    "LineConnect": LineConnect,
    "TestInvoiceGeneration": TestInvoiceGeneration,
    "CronJobSettings": CronJobSettings,
    "PublicInvoice": PublicInvoice,
    "FacebookTestDemo": FacebookTestDemo,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};