import { DailyReportManagementBase } from './DailyReportManagement'

/** 验收日报：与工程量日报同一套作业列表、筛选、分组与栏位，每行“验收”列为 +，点击后弹窗完善 RFI 信息并保存到 inspectiondb */
const InspectionDBPage = () => {
  return <DailyReportManagementBase mode="INSPECTION" />
}

export default InspectionDBPage
