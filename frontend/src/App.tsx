import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { App as AntdApp } from 'antd'

import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import { AuthProvider } from './contexts/AuthContext'
import AccountManagement from './pages/AccountManagement'
import BOMStructure from './pages/BOMStructure'
import DepartmentManagement from './pages/DepartmentManagement'
import DrawingLibrary from './pages/DrawingLibrary'
import EquipmentDashboard from './pages/EquipmentDashboard'
import FacilityManagement from './pages/FacilityManagement'
import HelpPage from './pages/HelpPage'
import Login from './pages/Login'
import ManufacturingCockpit from './pages/ManufacturingCockpit'
import ManufacturingOrderManagement from './pages/ManufacturingOrderManagement'
import MaterialManagement from './pages/MaterialManagement'
import ProcessTemplateConfig from './pages/ProcessTemplateConfig'
import ProcurementManagement from './pages/ProcurementManagement'
import Profile from './pages/Profile'
import QualityManagement from './pages/QualityManagement'
import SystemAdminPage from './pages/SystemAdminPage'

function App() {
  return (
    <AntdApp>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: false,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/manufacturing" replace />} />
                      <Route path="/manufacturing" element={<ManufacturingCockpit />} />
                      <Route path="/manufacturing/orders" element={<ManufacturingOrderManagement />} />
                      <Route path="/manufacturing/materials" element={<MaterialManagement />} />
                      <Route path="/manufacturing/bom" element={<BOMStructure />} />
                      <Route path="/manufacturing/process-templates" element={<Navigate to="/process-template-config" replace />} />
                      <Route path="/process-template-config" element={<ProcessTemplateConfig />} />
                      <Route path="/manufacturing/procurement" element={<ProcurementManagement />} />
                      <Route path="/manufacturing/quality" element={<QualityManagement />} />
                      <Route path="/manufacturing/equipment" element={<EquipmentDashboard />} />
                      <Route path="/manufacturing/facilities" element={<FacilityManagement />} />
                      <Route path="/manufacturing/drawings" element={<DrawingLibrary />} />
                      <Route path="/facility-management" element={<Navigate to="/manufacturing/facilities" replace />} />
                      <Route path="/external-data/mdr" element={<Navigate to="/manufacturing/drawings" replace />} />
                      <Route path="/tools/ocr" element={<Navigate to="/manufacturing/drawings" replace />} />
                      <Route path="/account-management" element={<AccountManagement />} />
                      <Route path="/department-management" element={<DepartmentManagement />} />
                      <Route path="/system-admin" element={<SystemAdminPage />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/users" element={<Navigate to="/account-management" replace />} />
                      <Route path="/permissions" element={<Navigate to="/account-management" replace />} />
                      <Route path="*" element={<Navigate to="/manufacturing" replace />} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AntdApp>
  )
}

export default App
