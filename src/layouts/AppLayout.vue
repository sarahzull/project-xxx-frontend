<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'
import ThemeToggle from '../components/common/ThemeToggle.vue'
import {
  DashboardIcon, DriversIcon, TruckIcon, PayIcon, ReportsIcon,
  RatesIcon, UserManagementIcon, MoreIcon, MenuIcon, ChevronRightIcon, LogoutIcon,
  EarningsIcon, PayslipIcon, CommunicationsIcon,
  SafetyIcon, AuditLogIcon,
} from '../components/icons/index.js'
import NotificationBell from '../components/common/NotificationBell.vue'

const auth          = useAuthStore()
const notifications = useNotificationsStore()
const router        = useRouter()
const route         = useRoute()
const sidebarOpen   = ref(false)

// Initialise notifications as soon as the app shell mounts
onMounted(() => {
  if (!notifications.initialized) notifications.fetchNotifications()
})

const isAdmin = computed(() => auth.hasRole('admin'))

const allNavigation = [
  { name: 'Dashboard',    path: '/',             icon: DashboardIcon,      roles: null },
  { name: 'Drivers',      path: '/drivers',      icon: DriversIcon,        roles: ['admin'] },
  { name: 'Trips',        path: '/trips',        icon: TruckIcon,          roles: null },
  { name: 'Compensation', path: '/compensation', icon: PayIcon,            roles: ['admin'] },
  { name: 'Reports',      path: '/reports',      icon: ReportsIcon,        roles: ['admin'] },
  { name: 'Rates',        path: '/rates',        icon: RatesIcon,          roles: ['admin'] },
  { name: 'Users',        path: '/users',        icon: UserManagementIcon, roles: ['admin'] },
  // Driver-specific
  { name: 'Earnings',     path: '/earnings',     icon: EarningsIcon,       roles: ['driver'] },
  { name: 'Payslips',     path: '/payslips',     icon: PayslipIcon,        roles: ['driver'] },
  // All roles
  { name: 'Communications', path: '/communications', icon: CommunicationsIcon, roles: null },
  // Coming soon (visual placeholders, no route yet)
  { name: 'Safety Driving', path: null, icon: SafetyIcon,   roles: ['admin'], comingSoon: true },
  { name: 'Audit Logs',     path: '/audit-logs', icon: AuditLogIcon, roles: ['admin'] },
]

const navigation = computed(() =>
  allNavigation.filter(item => !item.roles || item.roles.some(r => auth.hasRole(r)))
)

const allBottomNav = [
  // Shared
  { name: 'Home',     path: '/',             icon: DashboardIcon, roles: null },
  // Admin bottom 4
  { name: 'Drivers',  path: '/drivers',      icon: DriversIcon,   roles: ['admin'] },
  { name: 'Trips',    path: '/trips',        icon: TruckIcon,     roles: ['admin'] },
  { name: 'Pay',      path: '/compensation', icon: PayIcon,       roles: ['admin'] },
  // Driver bottom 4
  { name: 'Trips',    path: '/trips',        icon: TruckIcon,     roles: ['driver'] },
  { name: 'Earnings', path: '/earnings',     icon: EarningsIcon,  roles: ['driver'] },
  { name: 'Payslips', path: '/payslips',     icon: PayslipIcon,   roles: ['driver'] },
  { name: 'Comms',    path: '/communications', icon: CommunicationsIcon, roles: ['driver'] },
  // More only needed for admin (Reports, Rates, Users, Letters overflow)
  { name: 'More',     path: null,            icon: MoreIcon,      roles: ['admin'] },
]

const bottomNav = computed(() =>
  allBottomNav.filter(item => !item.roles || item.roles.some(r => auth.hasRole(r)))
)

const showMoreMenu = ref(false)

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

function userInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="app-shell">
    <!-- Backdrop (mobile) -->
    <div
      :class="[
        'backdrop',
        (sidebarOpen || showMoreMenu) && 'open',
        showMoreMenu && !sidebarOpen && 'backdrop--light',
      ]"
      @click="sidebarOpen = false; showMoreMenu = false"
    />

    <!-- ── Sidebar ── -->
    <aside :class="['sidebar', sidebarOpen && 'open']">
      <div class="sidebar-brand">
        <div class="sidebar-brand-dot" />
        <span class="sidebar-brand-name">Project XXX</span>
      </div>

      <nav class="sidebar-nav">
        <template v-for="item in navigation" :key="item.name">
          <router-link
            v-if="!item.comingSoon"
            :to="item.path"
            :class="['nav-item', isActive(item.path) && 'active']"
            @click="sidebarOpen = false"
          >
            <component :is="item.icon" class="nav-icon" />
            {{ item.name }}
          </router-link>
          <button
            v-else
            type="button"
            class="nav-item nav-item--soon"
            disabled
            :aria-disabled="true"
            :title="`${item.name} — coming soon`"
          >
            <component :is="item.icon" class="nav-icon" />
            <span class="nav-item-label">{{ item.name }}</span>
            <span class="nav-soon-pill">Soon</span>
          </button>
        </template>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/profile" class="sidebar-user sidebar-user--link" @click="sidebarOpen = false">
          <div class="sidebar-avatar">
            <img v-if="auth.user?.photo" :src="auth.user.photo" class="sidebar-avatar-img" alt="avatar" />
            <span v-else>{{ userInitials(auth.userName) }}</span>
          </div>
          <div class="sidebar-user-info">
            <span class="sidebar-username">{{ auth.userName }}</span>
            <span class="sidebar-role-badge" :class="isAdmin ? 'role-admin' : 'role-driver'">
              {{ isAdmin ? 'Admin' : 'Driver' }}
            </span>
          </div>
          <ChevronRightIcon :size="14" class="sidebar-user-arrow" />
        </router-link>
        <button class="sidebar-logout" @click="handleLogout">
          <LogoutIcon :size="15" />
          Logout
        </button>
      </div>
    </aside>

    <!-- ── Main content ── -->
    <div class="main-wrap">
      <!-- Top bar -->
      <header class="app-header">
        <button class="header-menu-btn" @click="sidebarOpen = true">
          <MenuIcon :size="20" />
        </button>
        <span class="header-brand">Project XXX</span>
        <div class="header-spacer" />
        <div class="header-right">
          <!-- Notification bell -->
          <NotificationBell />
          <!-- Profile avatar -->
          <router-link to="/profile" class="header-avatar" :title="auth.userName">
            <img v-if="auth.user?.photo" :src="auth.user.photo" class="header-avatar-img" alt="Profile" />
            <span v-else class="header-avatar-init">{{ userInitials(auth.userName) }}</span>
          </router-link>
          <ThemeToggle />
          <!-- Logout icon button -->
          <div class="header-tooltip-wrap">
            <button class="header-logout-icon" aria-label="Logout" @click="handleLogout">
              <LogoutIcon :size="17" />
            </button>
            <!-- <span class="header-tooltip">Logout</span> -->
          </div>
        </div>
        <!-- Mobile: theme toggle always visible -->
        <ThemeToggle class="header-theme-mobile" />
      </header>

      <!-- Page content -->
      <main class="page">
        <router-view />
      </main>
    </div>

    <!-- ── Mobile bottom nav ── -->
    <nav class="bottom-nav">
      <!-- More menu popup -->
      <div v-if="showMoreMenu" class="bn-more-menu">
        <div class="bn-more-handle" />
        <template
          v-for="item in navigation.filter(n => !bottomNav.some(b => b.path && b.path === n.path))"
          :key="item.name"
        >
          <router-link
            v-if="!item.comingSoon"
            :to="item.path"
            :class="['bn-more-link', isActive(item.path) && 'active']"
            @click="showMoreMenu = false"
          >
            <component :is="item.icon" :size="18" class="bn-more-link-icon" />
            {{ item.name }}
          </router-link>
          <button
            v-else
            type="button"
            class="bn-more-link bn-more-link--soon"
            disabled
            :aria-disabled="true"
            :title="`${item.name} — coming soon`"
          >
            <component :is="item.icon" :size="18" class="bn-more-link-icon" />
            <span>{{ item.name }}</span>
            <span class="nav-soon-pill">Soon</span>
          </button>
        </template>
        <div class="bn-more-divider" />
        <button class="bn-more-logout" @click="handleLogout">
          <LogoutIcon :size="18" class="bn-more-link-icon" />
          Logout
        </button>
      </div>

      <template v-for="item in bottomNav" :key="item.name">
        <router-link
          v-if="item.path"
          :to="item.path"
          :class="['bn-item', isActive(item.path) && 'active']"
          @click="showMoreMenu = false"
        >
          <component :is="item.icon" :size="22" />
          <span>{{ item.name }}</span>
        </router-link>

        <button
          v-else
          :class="['bn-item', showMoreMenu && 'active']"
          @click="showMoreMenu = !showMoreMenu"
        >
          <MoreIcon :size="22" />
          <span>More</span>
        </button>
      </template>
    </nav>
  </div>
</template>

<style scoped>
/* Mobile theme toggle — always visible next to hamburger */
.header-theme-mobile { display: flex; }
@media (min-width: 1024px) { .header-theme-mobile { display: none; } }

/* Sidebar user info layout */
.sidebar-user-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.sidebar-role-badge {
  display: inline-block; width: fit-content;
  font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; padding: 1px 6px; border-radius: 4px;
  margin-top: 2px;
}
.role-admin  { background: rgba(59,130,246,0.18);  color: #93C5FD; }
.role-driver { background: rgba(34,197,94,0.15);   color: #6EE7B7; }

/* Sidebar user as clickable profile link */
.sidebar-user--link {
  text-decoration: none; border-radius: 10px;
  transition: background var(--dur);
  padding: 6px 8px; margin: -6px -8px;
}
.sidebar-user--link:hover { background: rgba(255,255,255,0.07); }
.sidebar-user-arrow { flex-shrink: 0; opacity: 0.4; color: #CBD5E1; }

/* Avatar photo support */
.sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* "Coming soon" placeholder menu items — render like a nav-item but inert */
.nav-item--soon {
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: not-allowed;
  opacity: 0.78;
  font-family: inherit;
  color: var(--sb-text);
}
.nav-item--soon:disabled { color: var(--sb-text); }
.nav-item--soon:hover { background: transparent; opacity: 0.85; }
.nav-item-label { flex: 1; min-width: 0; }
.nav-soon-pill {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border-radius: 999px;
  background: rgba(148,163,184,0.22);
  color: #E2E8F0;
}
.bn-more-link--soon {
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: not-allowed;
  opacity: 0.78;
  font-family: inherit;
  color: var(--c-text-2);
}
.bn-more-link--soon:disabled { color: var(--c-text-2); }
.bn-more-link--soon:hover { background: transparent; }
</style>
