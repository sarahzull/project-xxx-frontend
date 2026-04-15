<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import ThemeToggle from '../components/common/ThemeToggle.vue'
import {
  DashboardIcon, DriversIcon, TruckIcon, PayIcon, ReportsIcon,
  RatesIcon, UserManagementIcon, MoreIcon, MenuIcon, ChevronRightIcon, LogoutIcon,
  EarningsIcon, PayslipIcon, LetterIcon,
} from '../components/icons/index.js'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)

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
  { name: 'Letters',      path: '/letters',      icon: LetterIcon,         roles: null },
]

const navigation = computed(() =>
  allNavigation.filter(item => !item.roles || item.roles.some(r => auth.hasRole(r)))
)

const allBottomNav = [
  { name: 'Home',     path: '/',             icon: DashboardIcon, roles: null },
  { name: 'Drivers',  path: '/drivers',      icon: DriversIcon,   roles: ['admin'] },
  { name: 'Trips',    path: '/trips',        icon: TruckIcon,     roles: null },
  { name: 'Pay',      path: '/compensation', icon: PayIcon,       roles: ['admin'] },
  { name: 'Earnings', path: '/earnings',     icon: EarningsIcon,  roles: ['driver'] },
  { name: 'Payslips', path: '/payslips',     icon: PayslipIcon,   roles: ['driver'] },
  { name: 'More',     path: null,            icon: MoreIcon,      roles: null },
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
    <div :class="['backdrop', (sidebarOpen || showMoreMenu) && 'open']" @click="sidebarOpen = false; showMoreMenu = false" />

    <!-- ── Sidebar ── -->
    <aside :class="['sidebar', sidebarOpen && 'open']">
      <div class="sidebar-brand">
        <div class="sidebar-brand-dot" />
        <span class="sidebar-brand-name">Project XXX</span>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="['nav-item', isActive(item.path) && 'active']"
          @click="sidebarOpen = false"
        >
          <component :is="item.icon" class="nav-icon" />
          {{ item.name }}
        </router-link>
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
        <router-link
          v-for="item in navigation.filter(n => !bottomNav.some(b => b.path === n.path))"
          :key="item.path"
          :to="item.path"
          :class="['bn-more-link', isActive(item.path) && 'active']"
          @click="showMoreMenu = false"
        >
          {{ item.name }}
        </router-link>
        <button class="bn-more-logout" @click="handleLogout">Logout</button>
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
.role-admin  { background: #DBEAFE; color: #1D4ED8; }
.role-driver { background: #D1FAE5; color: #047857; }

/* Sidebar user as clickable profile link */
.sidebar-user--link {
  text-decoration: none; border-radius: 10px;
  transition: background var(--dur);
  padding: 6px 8px; margin: -6px -8px;
}
.sidebar-user--link:hover { background: rgba(255,255,255,0.07); }
.sidebar-user-arrow { flex-shrink: 0; opacity: 0.4; color: var(--c-text-3); }

/* Avatar photo support */
.sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
</style>
