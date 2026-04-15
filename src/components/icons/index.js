/**
 * Centralized icon system for Fleet Management System
 *
 * Library: Lucide Vue Next
 * Style:   Stroke-only, consistent 1.75 stroke width
 * Default: size=20, strokeWidth=1.75, color=currentColor
 *
 * Usage:
 *   import { TruckIcon, DriverIcon } from '@/components/icons'
 *   <TruckIcon />
 *   <TruckIcon :size="24" color="#2563EB" />
 *
 * Dynamic usage:
 *   import Icon from '@/components/icons/Icon.vue'
 *   <Icon name="truck" />
 *   <Icon name="driver" :size="20" />
 */

import { defineComponent, h } from 'vue'
import {
  // Fleet / business icons
  LayoutDashboard,
  UserRound,
  Users,
  Truck,
  CircleDollarSign,
  BarChart3,
  Table2,
  UserCog,
  ClipboardList,
  TriangleAlert,
  Download,
  Droplets,
  IdCard,
  Gauge,
  Route,
  // UI icons
  Search,
  Filter,
  X,
  Menu,
  MoreHorizontal,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Check,
  CircleCheck,
  Info,
  User,
  Calendar,
  FileText,
  Camera,
  XCircle,
  // Dashboard enhancement icons
  UserX,
  UserPlus,
  UserCheck,
  TrendingDown,
  TrendingUp,
  Clock,
  Activity,
  Cake,
  ArrowRight,
  ShieldAlert,
  Wifi,
  WifiOff,
  // Earnings / payslips / letters
  Receipt,
  Mail,
  MailOpen,
  Send,
} from 'lucide-vue-next'

// ── Icon defaults ────────────────────────────────────────────────────────────
const DEFAULT_SIZE         = 20
const DEFAULT_STROKE_WIDTH = 1.75

/**
 * Factory: wraps a Lucide icon with fleet-standard defaults.
 * All props (size, color, strokeWidth) can be overridden per instance.
 * Extra attrs (class, style, aria-*) pass through automatically.
 */
function makeIcon(LucideComp, displayName) {
  return defineComponent({
    name: displayName,
    props: {
      size:        { type: [Number, String], default: DEFAULT_SIZE },
      color:       { type: String,           default: 'currentColor' },
      strokeWidth: { type: [Number, String], default: DEFAULT_STROKE_WIDTH },
    },
    setup(props, { attrs }) {
      return () => h(LucideComp, { ...props, ...attrs })
    },
  })
}

// ── Fleet / business icons ───────────────────────────────────────────────────
/** Main dashboard grid view */
export const DashboardIcon      = makeIcon(LayoutDashboard,    'DashboardIcon')
/** Single driver profile / avatar */
export const DriverIcon         = makeIcon(UserRound,          'DriverIcon')
/** Drivers list / team */
export const DriversIcon        = makeIcon(Users,              'DriversIcon')
/** Trip / vehicle / tanker */
export const TruckIcon          = makeIcon(Truck,              'TruckIcon')
/** Compensation / payroll */
export const PayIcon            = makeIcon(CircleDollarSign,   'PayIcon')
/** Reports / analytics */
export const ReportsIcon        = makeIcon(BarChart3,          'ReportsIcon')
/** Rates / rate table */
export const RatesIcon          = makeIcon(Table2,             'RatesIcon')
/** User management / system accounts */
export const UserManagementIcon = makeIcon(UserCog,            'UserManagementIcon')
/** Payroll batch / clipboard */
export const BatchIcon          = makeIcon(ClipboardList,      'BatchIcon')
/** License alert / warning */
export const AlertIcon          = makeIcon(TriangleAlert,      'AlertIcon')
/** Export / download payroll */
export const ExportIcon         = makeIcon(Download,           'ExportIcon')
/** Oil company / fuel */
export const FuelIcon           = makeIcon(Droplets,           'FuelIcon')
/** Driver license / ID card */
export const IdCardIcon         = makeIcon(IdCard,             'IdCardIcon')
/** Odometer / distance gauge */
export const GaugeIcon          = makeIcon(Gauge,              'GaugeIcon')
/** Trip route / map */
export const RouteIcon          = makeIcon(Route,              'RouteIcon')
/** Calendar / date */
export const CalendarIcon       = makeIcon(Calendar,           'CalendarIcon')
/** Document / file */
export const DocumentIcon       = makeIcon(FileText,           'DocumentIcon')
/** Photo / camera upload */
export const PhotoIcon          = makeIcon(Camera,             'PhotoIcon')

// ── UI icons ─────────────────────────────────────────────────────────────────
export const SearchIcon       = makeIcon(Search,         'SearchIcon')
export const FilterIcon       = makeIcon(Filter,         'FilterIcon')
export const CloseIcon        = makeIcon(X,              'CloseIcon')
export const MenuIcon         = makeIcon(Menu,           'MenuIcon')
export const MoreIcon         = makeIcon(MoreHorizontal, 'MoreIcon')
export const MoonIcon         = makeIcon(Moon,           'MoonIcon')
export const SunIcon          = makeIcon(Sun,            'SunIcon')
export const LogoutIcon       = makeIcon(LogOut,         'LogoutIcon')
export const ChevronRightIcon = makeIcon(ChevronRight,   'ChevronRightIcon')
export const ChevronLeftIcon  = makeIcon(ChevronLeft,    'ChevronLeftIcon')
export const ChevronDownIcon  = makeIcon(ChevronDown,    'ChevronDownIcon')
export const ViewIcon         = makeIcon(Eye,            'ViewIcon')
export const EditIcon         = makeIcon(Pencil,         'EditIcon')
export const TrashIcon        = makeIcon(Trash2,         'TrashIcon')
export const AddIcon          = makeIcon(Plus,           'AddIcon')
export const CheckIcon        = makeIcon(Check,          'CheckIcon')
export const CheckCircleIcon  = makeIcon(CircleCheck,    'CheckCircleIcon')
export const InfoIcon         = makeIcon(Info,           'InfoIcon')
export const UserIcon         = makeIcon(User,           'UserIcon')
export const CancelIcon       = makeIcon(XCircle,        'CancelIcon')

// ── Dashboard enhancement icons ──────────────────────────────────────────────
/** Blocked / removed user */
export const UserBlockIcon    = makeIcon(UserX,          'UserBlockIcon')
/** New driver / user created */
export const UserAddIcon      = makeIcon(UserPlus,       'UserAddIcon')
/** Driver unblocked / reinstated */
export const UserUnblockIcon  = makeIcon(UserCheck,      'UserUnblockIcon')
/** Performance declining / rank risk */
export const TrendingDownIcon = makeIcon(TrendingDown,   'TrendingDownIcon')
/** Time / expiry indicator */
export const ClockIcon        = makeIcon(Clock,          'ClockIcon')
/** Activity / event feed */
export const ActivityIcon     = makeIcon(Activity,       'ActivityIcon')
/** Birthday / HR celebration */
export const CakeIcon         = makeIcon(Cake,           'CakeIcon')
/** Navigate to detail arrow */
export const ArrowRightIcon   = makeIcon(ArrowRight,     'ArrowRightIcon')
/** Risk / security warning */
export const ShieldAlertIcon  = makeIcon(ShieldAlert,    'ShieldAlertIcon')
/** Online / available status */
export const OnlineIcon       = makeIcon(Wifi,           'OnlineIcon')
/** Offline / unavailable status */
export const OfflineIcon      = makeIcon(WifiOff,        'OfflineIcon')
/** Driver earnings / income trend */
export const EarningsIcon     = makeIcon(TrendingUp,     'EarningsIcon')
/** Payslip / receipt */
export const PayslipIcon      = makeIcon(Receipt,        'PayslipIcon')
/** Letter / unread mail */
export const LetterIcon       = makeIcon(Mail,           'LetterIcon')
/** Letter / read mail */
export const LetterOpenIcon   = makeIcon(MailOpen,       'LetterOpenIcon')
/** Send letter */
export const SendIcon         = makeIcon(Send,           'SendIcon')

// ── Icon name registry (used by <Icon name="..."> dynamic wrapper) ───────────
export const ICON_REGISTRY = {
  // Fleet
  dashboard:       DashboardIcon,
  driver:          DriverIcon,
  drivers:         DriversIcon,
  truck:           TruckIcon,
  pay:             PayIcon,
  reports:         ReportsIcon,
  rates:           RatesIcon,
  'user-management': UserManagementIcon,
  batch:           BatchIcon,
  alert:           AlertIcon,
  export:          ExportIcon,
  fuel:            FuelIcon,
  'id-card':       IdCardIcon,
  gauge:           GaugeIcon,
  route:           RouteIcon,
  calendar:        CalendarIcon,
  document:        DocumentIcon,
  photo:           PhotoIcon,
  // UI
  search:          SearchIcon,
  filter:          FilterIcon,
  close:           CloseIcon,
  menu:            MenuIcon,
  more:            MoreIcon,
  moon:            MoonIcon,
  sun:             SunIcon,
  logout:          LogoutIcon,
  'chevron-right': ChevronRightIcon,
  'chevron-left':  ChevronLeftIcon,
  'chevron-down':  ChevronDownIcon,
  view:            ViewIcon,
  edit:            EditIcon,
  trash:           TrashIcon,
  add:             AddIcon,
  check:           CheckIcon,
  'check-circle':  CheckCircleIcon,
  info:            InfoIcon,
  user:            UserIcon,
  cancel:          CancelIcon,
  // Dashboard enhancement
  'user-block':    UserBlockIcon,
  'user-add':      UserAddIcon,
  'user-unblock':  UserUnblockIcon,
  'trending-down': TrendingDownIcon,
  clock:           ClockIcon,
  activity:        ActivityIcon,
  cake:            CakeIcon,
  'arrow-right':   ArrowRightIcon,
  'shield-alert':  ShieldAlertIcon,
  online:          OnlineIcon,
  offline:         OfflineIcon,
  earnings:        EarningsIcon,
  payslip:         PayslipIcon,
  letter:          LetterIcon,
  'letter-open':   LetterOpenIcon,
  send:            SendIcon,
}
