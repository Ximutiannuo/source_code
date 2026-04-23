Attribute VB_Name = "r_byteamactivity"
Sub SeperateActivitybyConstructionTeams()
Dim ODB
'Application.ScreenUpdating = False
'Application.Calculation = xlCalculationManual

startTime = Timer
ODB = Sheets("Activity List( from TEAMs)").ListObjects("Construction_Teams").DataBodyRange.Value
ODBqty = Sheets("ConsQuantityControl").ListObjects("ConsQuantityControl").DataBodyRange.Value
Set dic = CreateObject("scripting.dictionary")
Set dicqty = CreateObject("scripting.dictionary")

For i = LBound(ODB, 1) To UBound(ODB, 1)
    For j = 3 To UBound(ODB, 2)
        If j = 3 Then
            If ODB(i, j) = Empty Then
                tempstr = " "
            Else
                tempstr = ODB(i, j)
            End If
        Else
            If ODB(i, j) = Empty Then
                tempstr = tempstr & "@" & " "
            Else
                tempstr = tempstr & "@" & ODB(i, j)
            End If
        End If
        dic(ODB(i, 2)) = tempstr
    Next
Next

For i = LBound(ODBqty, 1) To UBound(ODBqty, 1)
    For j = 2 To UBound(ODBqty, 2)
        If j = 2 Then
            If ODBqty(i, j) = Empty Then
                tempstr = " "
            Else
                tempstr = ODBqty(i, j)
            End If
        Else
            If ODBqty(i, j) = Empty Then
                tempstr = tempstr & "@" & " "
            Else
                tempstr = tempstr & "@" & ODBqty(i, j)
            End If
        End If
        dicqty(ODB(i, 2)) = tempstr
    Next
Next

t1 = dic.Items
t2 = dicqty.Items

Set fso = CreateObject("scripting.filesystemobject")
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\Construction Teams\"

Set fd = fso.GetFolder(fpath)
With Sheets("UpdateQuantity")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column - 2
    SUPP = .Range(.Cells(2, 1), .Cells(irow, icol))
End With

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    DataRange = .Range(.Cells(6, 1), .Cells(irow, icol))
End With

'3,5,6,10 project, team, name, id

ReDim temp(1 To UBound(DataRange, 1), 1 To icol)
Set d = CreateObject("scripting.dictionary")
For i = 1 To UBound(DataRange, 1)
    tempstr = DataRange(i, 14)
    If Not d.Exists(tempstr) Then
        ReDim brr(1 To icol)
    Else
        brr = d(tempstr)
    End If
    For m = LBound(brr) To UBound(brr)
        If DataRange(i, m) <> "" Then
            brr(m) = brr(m) & "@" & DataRange(i, m)
        Else
            brr(m) = brr(m) & "@" & " "
        End If
    Next
    d(tempstr) = brr

Next

k = d.Keys
t = d.Items
For i = LBound(t) To UBound(t)
    For j = LBound(t(i)) To UBound(t(i))
        Dim tempArray As Variant
        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
        t(i)(j) = tempArray
            
    Next
Next
For i = LBound(t) To UBound(t)
    'If Left(k(i), 1) = "C" Then
        Workbooks.Add
        With ActiveSheet
            .Range("j2:j" & UBound(t(i)(1)) + 2).NumberFormat = "@"
            For j = LBound(DataRange, 2) To UBound(DataRange, 2) - 16
                .Cells(1, j) = ThisWorkbook.Sheets("Activity List").Cells(5, j)
            Next
            .Cells(1, 19).Value = "Act Status 作业状态"
            .Cells(1, 20).Value = "Total Quantity 预估总量"
            .Cells(1, 21).Value = "Budgeted Quantity 基准计划完成量"
            .Cells(1, 22).Value = "Forecast Quantity 滚动计划完成量"
            .Cells(1, 23).Value = "Achieved Quantity 实际累计完成量"
            .Cells(1, 24).Value = "BL Project Start 基准开始"
            .Cells(1, 25).Value = "BL Project Finish 基准完成"
            .Cells(1, 26).Value = "Forecast Start 预测开始"
            .Cells(1, 27).Value = "Forecast Finish 预测完成"
            .Cells(1, 28).Value = "Actual Start 实际开始"
            .Cells(1, 29).Value = "Actual Finish 实际完成"
            .Cells(1, 30).Value = "Status 状态"
            .Cells(1, 31).Value = "Delayed Category(if necessary) 滞后类型（如需）"
            .Cells(1, 32).Value = "Analysis for the Delays 滞后分析详细描述"
            .Cells(1, 33).Value = "Remarks 备注"
            .Cells(1, 34).Value = "Cons. Total Quantity 施工分包商清理预估总量"
            .Cells(1, 35).Value = "Cons. AFC Quantity 施工分包商清理图纸批准量AFC"
            .Cells(1, 36).Value = "Cons. Achieved Quantity 根据日报同步的累计完成量"
            .Cells(1, 37).Value = "Cons. RFI(A) 施工分包商RFI类型A完成量"
            .Cells(1, 38).Value = "Cons. RFI(B) 施工分包商RFI类型B完成量"
            .Cells(1, 39).Value = "Cons. RFI(C) 施工分包商RFI类型C完成量"
            .Cells(1, 40).Value = "Cons. ABD RO 施工分包商竣工资料R0完成量"
            .Cells(1, 41).Value = "Cons. ABD R1 施工分包商竣工资料R1完成量"
            .Cells(1, 42).Value = "Cons. OBP 施工分包商OVR收款资料提交量"
            
    
            For m = LBound(t(i)) To 18
                For n = LBound(t(i)(m)) To UBound(t(i)(m))
                    .Cells(n + 2, m) = t(i)(m)(n)
                Next
            Next
            
            For m = LBound(t(i)(1)) To UBound(t(i)(1))
                If t(i)(35)(m) = " " Then t(i)(35)(m) = 0
                If t(i)(20)(m) = " " Then .Cells(m + 2, 20) = 0 Else .Cells(m + 2, 20) = t(i)(20)(m)
                If t(i)(41)(m) = " " Then .Cells(m + 2, 21) = 0 Else .Cells(m + 2, 21) = t(i)(41)(m)
                If t(i)(44)(m) = " " Then .Cells(m + 2, 22) = 0 Else .Cells(m + 2, 22) = t(i)(44)(m)
                If t(i)(35)(m) = " " Then .Cells(m + 2, 23) = 0 Else .Cells(m + 2, 23) = t(i)(35)(m)
                If t(i)(32)(m) = " " Then .Cells(m + 2, 28) = "" Else .Cells(m + 2, 28) = t(i)(32)(m)
                If t(i)(38)(m) <> " " Then
                    .Cells(m + 2, 29) = t(i)(33)(m)
                End If

                If t(i)(35)(m) * 1 < t(i)(41)(m) * 1 Then
                    .Cells(m + 2, 30) = "DELAY"
                End If
                
                If dic.Exists(t(i)(2)(m)) Then
                    tempArray = Split(dic(t(i)(2)(m)), "@")
                    If tempArray(0) = " " Then .Cells(m + 2, 19) = "" Else .Cells(m + 2, 19) = tempArray(0)
                    If tempArray(1) = " " Then .Cells(m + 2, 24) = 0 Else .Cells(m + 2, 24) = tempArray(1)
                    If tempArray(2) = " " Then .Cells(m + 2, 25) = 0 Else .Cells(m + 2, 25) = tempArray(2)
                    If tempArray(3) = " " Then .Cells(m + 2, 26) = 0 Else .Cells(m + 2, 26) = tempArray(3)
                    If tempArray(4) = " " Then .Cells(m + 2, 27) = 0 Else .Cells(m + 2, 27) = tempArray(4)
                    If tempArray(7) = " " Then .Cells(m + 2, 30) = "" Else .Cells(m + 2, 30) = tempArray(7)
                    If tempArray(8) = " " Then .Cells(m + 2, 31) = "" Else .Cells(m + 2, 31) = tempArray(8)
                    If tempArray(9) = " " Then .Cells(m + 2, 32) = "" Else .Cells(m + 2, 32) = tempArray(9)
                    If tempArray(10) = " " Then .Cells(m + 2, 33) = "" Else .Cells(m + 2, 33) = tempArray(10)
                End If
                If dicqty.Exists(t(i)(2)(m)) Then
                    tempArray = Split(dicqty(t(i)(2)(m)), "@")
                    For n = LBound(tempArray) To UBound(tempArray)
                        If tempArray(n) = " " Then .Cells(m + 2, n + 34) = "" Else .Cells(m + 2, n + 34) = tempArray(n)
                    Next
                End If
            Next
            lastRow = .Cells(Rows.Count, 1).End(xlUp).Row
            
            With .Range("S2:S" & lastRow).Validation
                .Delete ' Clear any existing validation
                .Add Type:=xlValidateList, _
                     AlertStyle:=xlValidAlertStop, _
                     Operator:=xlBetween, _
                     Formula1:="Not Started, In Progress, Completed"
                .IgnoreBlank = True
                .InCellDropdown = True
                .ShowInput = True
                .ShowError = True
            End With
            ' Add data validation to column AB
            With .Range("AE2:AE" & lastRow).Validation
                .Delete ' Clear any existing validation
                .Add Type:=xlValidateList, _
                     AlertStyle:=xlValidAlertStop, _
                     Operator:=xlBetween, _
                     Formula1:="Material Delivery Issue 材料到货问题,Material Outbound Issue 材料出库问题,Manpower Shortage 人力短缺,Engineering Issue including TEQ 设计问题或升版,Machinery Shortage 机具短缺"
                .IgnoreBlank = True
                .InCellDropdown = True
                .ShowInput = True
                .ShowError = True
            End With
            
            .Range("a1").CurrentRegion.Select
            With Selection
                .EntireColumn.AutoFit
                .Borders.LineStyle = xlContinuous
                .Borders.Color = RGB(0, 0, 0)
                .Borders.Weight = xlThin
                .Range("a:a").Group
                .Range("c:g").Group
                .Range("i:j").Group
                .Range("l:m").Group
                .Range("p:r").Group
                .Range("s1:ad1").EntireColumn.ColumnWidth = 11
                .Range("s1:ag1").WrapText = True
                .Range("s1:ad1").Font.Size = 9
                .Range("ae1").EntireColumn.ColumnWidth = 15
                .Range("af1").EntireColumn.ColumnWidth = 20
                .Range("ah1:ap1").EntireColumn.ColumnWidth = 15
                .Range("ah1:ap1").Font.Size = 9
                .Range("ah1:ap1").WrapText = True
                .Range("ah1:aj1").Interior.Color = RGB(255, 192, 0)
                .Range("ak1:am1").Interior.Color = RGB(181, 230, 162)
                .Range("an1:ao1").Interior.Color = RGB(228, 158, 221)
                .Range("ap1").Interior.Color = RGB(148, 220, 248)
                
                If ActiveSheet.AutoFilterMode = True Then
                Else
                    .Range("a1").CurrentRegion.AutoFilter
                End If
            End With
            
            .Range("b2").Select
            ActiveWindow.FreezePanes = True
        End With
        For Each fl In fd.Files
            If fl.Name = k(i) & ".xlsx" Then
                Kill fl
            End If
        Next
        ActiveWorkbook.SaveAs Filename:=fpath & k(i), FileFormat:=51
        ActiveWorkbook.AutoSaveOn = True
        ActiveWorkbook.Close True
    'End If
Next
'Application.ScreenUpdating = True
'Application.Calculation = xlCalculationAutomatic
'FinishTime = Timer
'ElapsedTime = FinishTime - StartTime
'MsgBox "File Distribution Completed, Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."

End Sub

Sub sendschedule()

Dim sh34ar As Variant
Dim fso As Scripting.FileSystemObject, fd, fl
Dim i As Integer, j As Integer
Dim olApp As Outlook.Application, olItem As Outlook.MailItem
Dim ts As Scripting.TextStream, strBody As String, sigPath As String, sigText As String
Dim fpath As String

Set fso = New Scripting.FileSystemObject
sigPath = Environ("appdata") & "\Microsoft\Signatures\AutoSender.htm"
Set ts = fso.OpenTextFile(sigPath)
sigText = ts.ReadAll
ts.Close

sh34ar = Sheets("FILENAME").Range("a1").CurrentRegion.Value

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\SEND\VFACT\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\Construction Teams\"

For i = 2 To UBound(sh34ar, 1)
    If sh34ar(i, 3) <> "" And sh34ar(i, 10) = "Y" Then
        Set olApp = CreateObject("Outlook.Application")
        Set olItem = olApp.CreateItem(olMailItem)
        strBody = "<body>" & _
                          "<head></head>" & _
                          "<span style='font-family: Arial;font-size:10pt;color:#012e75'>" & _
                          "Good morning, colleagues," & "<br><br>" & _
                          "We are sending you the work list of your company to help you better analyze the execution status of the plan. " & _
                          "Through this list, you can view the total quantity, planned quantity, completed quantity, and whether there is backlog for each task." & "<br><br>" & _
                          "Additionally, the following items require your completion:" & "<br>" & _
                          "1. Update task completion status: Every Friday, inform us which tasks have been completed. " & _
                          "(Please modify the cell value to ""Completed"" in column S using the drop-down menu)." & "<br><br>" & _
                          "2. Update the forecast start and forecast completion dates:" & "<br>" & _
                          "&nbsp;&nbsp;- For tasks not yet started: Except for critical paths, do not adjust tasks starting beyond 3 months in principle;" & "<br>" & _
                          "&nbsp;&nbsp;&nbsp;&nbsp;Adjust the start and end times for tasks starting within 3 months." & "<br>" & _
                          "&nbsp;&nbsp;- For ongoing tasks: Forecast start time equals actual start time. The forecast completion time will determine" & "<br>" & _
                          "&nbsp;&nbsp;&nbsp;&nbsp;the amount of resources earned within a certain period. Consider resource compression when filling in." & "<br>" & _
                          "&nbsp;&nbsp;- Completed tasks: No need to fill in forecast dates, the system will automatically identify them." & "<br><br>" & _
                          "! <strong>Critical Note:</strong> Baseline dates are locked. Modified dates will not be reflected in Annex 2 reports.<br><br>" & _
                          "<u>Submission Protocol:</u><br>" & _
                          "- This attachment will be sent daily via email. (effective from February 1st)" & "<br>" & _
                          "- Every Friday, please send this file with the daily report to xieguangjie@cc7.cn (no later than 11:00 a.m.)" & "<br><br>" & _
                          "Thank you for your cooperation." & "<br><br>" & _
                          "If you have any questions, please contact:" & "<br>" & _
                          "Xie Guangjie (+7 981 722 7260)" & "<br>" & "</span>" & "</body>"

        With olItem
            .Subject = sh34ar(i, 2)
            .HTMLBody = strBody & sigText
            .To = sh34ar(i, 3)
            .Attachments.Add fpath & "\" & sh34ar(i, 1) & ".xlsx"
            .Display
            .Importance = olImportanceHigh
            '.SendUsingAccount = olApp.Session.Accounts("xieguangjie@cc7.cn")
                ' 尝试找到第一个匹配的账号
            Dim sendAccount As Outlook.Account
            Dim accountFound As Boolean
            accountFound = False
            
            For Each sendAccount In olApp.Session.Accounts
                If sendAccount.SmtpAddress = "xieguangjie@cc7.cn" Or sendAccount.SmtpAddress = "liyuansen@cc7.cn" Then
                    .SendUsingAccount = sendAccount
                    accountFound = True
                    Exit For
                End If
            Next
            
            ' 检查是否找到匹配账号
            If Not accountFound Then
                MsgBox "未找到指定的邮箱账户，请检查配置。"
                Exit Sub
            End If
            .Send
        End With
        Set olApp = Nothing
        Set olItem = Nothing
    End If
Next i

End Sub

