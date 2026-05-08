import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '',              name: 'dashboard',    component: () => import('../views/dashboard/DashboardView.vue') },
      { path: 'profile',       name: 'profile',      component: () => import('../views/profile/ProfileView.vue') },
      { path: 'trips',         name: 'trips',        component: () => import('../views/trips/TripListView.vue') },

      // Admin-only routes
      { path: 'drivers',       name: 'drivers',      component: () => import('../views/drivers/DriverListView.vue'),            meta: { roles: ['admin'] } },
      { path: 'drivers/:id',   name: 'driver-detail',component: () => import('../views/drivers/DriverDetailView.vue'), props: true, meta: { roles: ['admin'] } },
      { path: 'compensation',  name: 'compensation', component: () => import('../views/compensation/BatchListView.vue'),         meta: { roles: ['admin'] } },
      { path: 'compensation/:id', name: 'batch-detail', component: () => import('../views/compensation/BatchDetailView.vue'), props: true, meta: { roles: ['admin'] } },
      { path: 'reports',       name: 'reports',      component: () => import('../views/reports/ReportsView.vue'),                meta: { roles: ['admin'] } },
      { path: 'rates',         name: 'rates',        component: () => import('../views/rates/RateManagementView.vue'),           meta: { roles: ['admin'] } },
      { path: 'users',         name: 'users',        component: () => import('../views/users/UserListView.vue'),                 meta: { roles: ['admin'] } },
      { path: 'audit-logs',    name: 'audit-logs',   component: () => import('../views/audit/AuditLogsView.vue'),                meta: { roles: ['admin'] } },
      { path: 'safety',        name: 'safety',       component: () => import('../views/safety/SafetyView.vue'),                  meta: { roles: ['admin'] } },

      // Driver-only routes
      { path: 'earnings',     name: 'earnings',     component: () => import('../views/earnings/EarningsView.vue'),   meta: { roles: ['driver'] } },
      { path: 'payslips',     name: 'payslips',     component: () => import('../views/payslips/PayslipsView.vue'),   meta: { roles: ['driver'] } },
      { path: 'my-safety',    name: 'my-safety',    component: () => import('../views/safety/MySafetyView.vue'),     meta: { roles: ['driver'] } },

      // All authenticated users — Driver Communications module
      { path: 'communications', name: 'communications', component: () => import('../views/communications/CommunicationsView.vue') },
      // Legacy redirect: /letters → /communications
      { path: 'letters', redirect: { name: 'communications' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.auth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Role guard — redirect to dashboard if user lacks required role
  if (to.meta.roles && !to.meta.roles.some(r => auth.hasRole(r))) {
    return { name: 'dashboard' }
  }
})

export default router
