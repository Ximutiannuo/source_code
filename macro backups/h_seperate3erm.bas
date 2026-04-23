Attribute VB_Name = "h_seperate3erm"
Sub Act_ERMcheck()

Dim csvFile As String, ws As Worksheet, MPDB

'PREPARE RAW DATA FOR CHECKING.
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 1
    clist = .Range(.Cells(6, 1), .Cells(irow, icol))
End With

Set MPDict = CreateObject("scripting.dictionary")

MPDB = Sheets("MP").ListObjects("MPDB").DataBodyRange.Value

For i = LBound(MPDB, 1) To UBound(MPDB, 1)
    If Not MPDict.Exists(MPDB(i, 2)) Then
        ReDim brr(1 To 3)
    Else
        brr = MPDict(MPDB(i, 2))
    End If
    brr(1) = brr(1) + MPDB(i, 5)
    If brr(2) = 0 Then
        brr(2) = MPDB(i, 1)
    Else
        If MPDB(i, 1) < brr(2) Then
            brr(2) = MPDB(i, 1)
        End If
    End If
    If MPDB(i, 1) > brr(3) Then
        brr(3) = MPDB(i, 1)
    End If
    MPDict(MPDB(i, 2)) = brr
Next

k = MPDict.Keys
t = MPDict.Items


'3,5,6,10 project, team, name, id
'ReDim temp(1 To UBound(clist, 1), 1 To icol)
'Set d = CreateObject("scripting.dictionary")
'For i = 2 To UBound(clist, 1)
'    If clist(i, 3) <> "" Then
'        tempstr = clist(i, 12)
'        If Not d.exists(tempstr) Then
'            ReDim brr(1 To icol)
'        Else
'            brr = d(tempstr)
'        End If
'        For m = LBound(brr) To UBound(brr)
'            If clist(i, m) <> "" Then
'                brr(m) = brr(m) & "@" & clist(i, m)
'            Else
'                brr(m) = brr(m) & "@" & " "
'            End If
'        Next
'        d(tempstr) = brr
'    End If
'Next
'
'k = d.keys
't = d.Items
'Set d = Nothing
'
'For i = LBound(t) To UBound(t)
'    For j = LBound(t(i)) To UBound(t(i))
'        Dim tempArray As Variant
'        tempArray = Split(Right(t(i)(j), Len(t(i)(j)) - 1), "@")
'        t(i)(j) = tempArray
'    Next
'Next


With Sheets("Act_ERM")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    existID = .Range("a2:y" & irow)
End With

'GET MISSING ITEMS.

ReDim missingitem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(existID, 0, 3)
    NewElement = d.item(it)
Next

cnt = 0
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If clist(itr, 3) <> "" Then  'Left(it, 3) <> "EX0" And
        If Not d.Exists(it) Then
            cnt = cnt + 1
            ReDim Preserve missingitem(1 To cnt)
            missingitem(cnt) = it
        End If
    End If
Next

Set d = Nothing
cnt = 0
itr = 0
'GET DELETE ITEMS.
ReDim DelItem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If clist(itr, 3) <> "" Then 'Left(it, 3) <> "EX0" And
        DelElement = d.item(it)
        d(it) = itr
    End If
Next
k1 = d.Keys
t1 = d.Items

For Each it In Application.Index(existID, 0, 3)
    If Not d.Exists(it) Then
        cnt = cnt + 1
        ReDim Preserve DelItem(1 To cnt)
        DelItem(cnt) = it
    End If
Next
Set d = Nothing
cnt = 0
itr = 0

'GET CHAGNE ITEMS.
ReDim changeItem(1 To 1)
Set d = CreateObject("scripting.dictionary")
For Each it In Application.Index(existID, 0, 3)
    itr = itr + 1
    If Len(existID(itr, 19)) < 3 Then
        NewElement = d.item(it & "-" & "NULL")
    Else
        NewElement = d.item(it & "-" & existID(itr, 19))
    End If
Next

cnt = 0
itr = 0
For Each it In Application.Index(clist, 0, 2)
    itr = itr + 1
    If clist(itr, 3) <> "" Then  'Left(it, 3) <> "EX0" And
        If clist(itr, 14) = "" Then
            If Not d.Exists(it & "-" & "NULL") Then
                cnt = cnt + 1
                ReDim Preserve changeItem(1 To cnt)
                changeItem(cnt) = it
            End If
        Else
            If Not d.Exists(it & "-" & clist(itr, 14)) Then
                cnt = cnt + 1
                ReDim Preserve changeItem(1 To cnt)
                changeItem(cnt) = it
            End If
        End If
    End If
Next

Set d = Nothing
cnt = 0
itr = 0

'TRANSPOSE TO LISTS - TO ADD ONE.
ReDim newAct(1 To UBound(missingitem, 1), 1 To UBound(clist, 2))
For i = LBound(newAct, 1) To UBound(newAct, 1)
    For j = LBound(k1) To UBound(k1)
        If missingitem(i) = clist(t1(j), 2) Then
            For m = LBound(newAct, 2) To UBound(newAct, 2)
                newAct(i, m) = clist(t1(j), m)
            Next
        End If
    Next
Next

'TRANSPOSE TO LISTS - TO CHANGE ONE.
ReDim changeAct(1 To UBound(changeItem, 1), 1 To UBound(clist, 2))
For i = LBound(changeAct, 1) To UBound(changeAct, 1)
    For j = LBound(clist, 1) To UBound(clist, 1)
        If changeItem(i) = clist(j, 2) Then
            For m = LBound(changeAct, 2) To UBound(changeAct, 2)
                changeAct(i, m) = clist(j, m)
            Next
        End If
    Next
Next



Dim existIDDict As Object
Set existIDDict = CreateObject("Scripting.Dictionary")

' 预处理existID数组，创建字典
For m = LBound(existID, 1) To UBound(existID, 1)
    existIDDict(existID(m, 3)) = m
Next m

If IsEmpty(missingitem(1)) And IsEmpty(DelItem(1)) And IsEmpty(changeItem(1)) Then
    MsgBox "No Missing Item need to be added, and no item need to be deleted or changed."
    
    ReDim wfList(1 To UBound(clist, 1) + 1, 1 To UBound(existID, 2))
    For i = LBound(wfList, 1) To UBound(wfList, 1)
        For j = LBound(existID, 2) To UBound(existID, 2)
            If i = 1 Then
                wfList(i, j) = Sheets("Act_ERM").Cells(1, j)
            Else
                wfList(i, 1) = "GCC"
                wfList(i, 2) = clist(i - 1, 7) & clist(i - 1, 5) & clist(i - 1, 15) & clist(i - 1, 13) & "001"
                wfList(i, 3) = clist(i - 1, 2)
                wfList(i, 4) = clist(i - 1, 11)
                wfList(i, 5) = "施工"
                wfList(i, 6) = clist(i - 1, 29)
                wfList(i, 7) = clist(i - 1, 30)
                wfList(i, 8) = "7Day_8_16:0"
                wfList(i, 9) = "TRUE"
                wfList(i, 10) = "工程量完工"

          
                wfList(i, 12) = clist(i - 1, 24) ' * 0.260039
                If existIDDict.Exists(clist(i - 1, 2)) Then
                    m = existIDDict(clist(i - 1, 2))
                    wfList(i, 11) = existID(m, 11)
                    wfList(i, 13) = existID(m, 13)
                    wfList(i, 25) = existID(m, 25)
                End If
                If MPDict.Exists(clist(i - 1, 2)) Then
                    m = MPDict(clist(i - 1, 2))
                    If m(2) > 0 And wfList(i, 11) <> "Finished" Then
                        wfList(i, 11) = "Started"
                    End If
                End If
                wfList(i, 14) = "Z00008"
                wfList(i, 15) = clist(i - 1, 8)
                wfList(i, 16) = clist(i - 1, 12)
                wfList(i, 18) = clist(i - 1, 5)
                wfList(i, 19) = clist(i - 1, 14)
                wfList(i, 20) = clist(i - 1, 15)
                wfList(i, 21) = clist(i - 1, 4)
                wfList(i, 22) = clist(i - 1, 6)
                wfList(i, 23) = clist(i - 1, 7)
                wfList(i, 24) = clist(i - 1, 13)
                If wfList(i, 11) = "" Then
                    wfList(i, 11) = "PlanningOnGoing"
                End If
            End If
        Next
    Next
    fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\ERM\"
    csvFile = fpath & "wfList.csv"
    WriteArrayToCSV wfList, csvFile
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    MsgBox "ERM Construction Weight Factor update completed!"
    UpdateBudgetMH
    UpdateVFACTtoERM
    UpdateMPDBtoERM
    Exit Sub
End If
Set fso = CreateObject("scripting.filesystemobject")
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\ERM\"
Set fd = fso.GetFolder(fpath)

ReDim addList(1 To UBound(newAct, 1) + 1, 1 To UBound(existID, 2))
For i = LBound(newAct, 1) To UBound(newAct, 1) + 1
    For j = LBound(existID, 2) To UBound(existID, 2)
        If i = 1 Then
            addList(i, j) = Sheets("Act_ERM").Cells(1, j)
        Else
            addList(i, 1) = "GCC"
            addList(i, 2) = newAct(i - 1, 7) & newAct(i - 1, 5) & newAct(i - 1, 15) & newAct(i - 1, 13) & "001"
            addList(i, 3) = newAct(i - 1, 2)
            addList(i, 4) = newAct(i - 1, 11)
            addList(i, 5) = "施工"
            addList(i, 6) = newAct(i - 1, 29)
            addList(i, 7) = newAct(i - 1, 30)
            addList(i, 8) = "7Day_8_16:0"
            addList(i, 9) = "TRUE"
            addList(i, 10) = "工程量完工"
        
        
            addList(i, 12) = newAct(i - 1, 24) '* 0.260039


            If MPDict.Exists(newAct(i - 1, 2)) Then
                addList(i, 11) = "Started"
            Else
                addList(i, 11) = "PlanningOngoing"
            End If

            addList(i, 14) = "Z00008"
            addList(i, 15) = newAct(i - 1, 8)
            addList(i, 16) = newAct(i - 1, 12)
            addList(i, 18) = newAct(i - 1, 5)
            addList(i, 19) = newAct(i - 1, 14)
            addList(i, 20) = newAct(i - 1, 15)
            addList(i, 21) = newAct(i - 1, 4)
            addList(i, 22) = newAct(i - 1, 6)
            addList(i, 23) = newAct(i - 1, 7)
            addList(i, 24) = newAct(i - 1, 13)
        
        End If
    Next
Next

ReDim updateList(1 To UBound(changeAct, 1) + 1, 1 To UBound(changeAct, 2))
For i = 1 To UBound(updateList, 1)
    For j = LBound(updateList, 2) To UBound(updateList, 2)
        If i = 1 Then
            updateList(i, j) = Sheets("Activity List").Cells(5, j).Value
        Else
            updateList(i, j) = changeAct(i - 1, j)
        End If
    Next
Next



ReDim deleteList(1 To UBound(DelItem) + 1, 1 To UBound(existID, 2))
For i = LBound(deleteList, 1) To UBound(deleteList, 1)
    For j = LBound(existID, 2) To UBound(existID, 2)
        If i = 1 And j < UBound(existID, 2) Then
            deleteList(i, j) = Sheets("Act_ERM").Cells(1, j)
        ElseIf i = 1 And j = UBound(existID, 2) Then
            deleteList(i, j) = "Delete this row"
        ElseIf j < UBound(existID, 2) Then
            If existIDDict.Exists(DelItem(i - 1)) Then
                m = existIDDict(DelItem(i - 1))
                deleteList(i, j) = existID(m, j)
                deleteList(i, UBound(deleteList, 2)) = "D"
            End If
        End If
    Next
Next



csvFile = fpath & "AddList.csv"
WriteArrayToCSV addList, csvFile

Set wb = Workbooks.Add
Set ws = wb.Sheets(1)
WriteArrayToWorksheet updateList, ws
wb.SaveAs fpath & "UpdateList.xlsx", xlOpenXMLWorkbook
wb.Close SaveChanges:=False

Set wb = Workbooks.Add
Set ws = wb.Sheets(1)
WriteArrayToWorksheet deleteList, ws
wb.SaveAs fpath & "DeleteList.xlsx", xlOpenXMLWorkbook
wb.Close SaveChanges:=False


MsgBox "ERM Construction Activity List Check & Update Completed!"

End Sub

Sub UpdateBudgetMH()

'excluded the activities without scope
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 1
    clist = .Range(.Cells(6, 1), .Cells(irow, icol))
End With

ReDim resultzero(1 To 6, 1 To 1)
For i = LBound(clist, 1) To UBound(clist, 1) + 1
    If i = 1 Then
        cnt = cnt + 1
        resultzero(1, i) = "Project"
        resultzero(2, i) = "Package"
        resultzero(3, i) = "ActivityVersion"
        resultzero(4, i) = "Resource"
        resultzero(5, i) = "System"
        resultzero(6, i) = "PlannedBudget"
    Else
        If clist(i - 1, 14) <> "" Then
            cnt = cnt + 1
            ReDim Preserve resultzero(1 To 6, 1 To cnt)
            resultzero(1, cnt) = clist(i - 1, 3)
            resultzero(3, cnt) = clist(i - 1, 2)
            resultzero(4, cnt) = clist(i - 1, 14) & "_MP"
            resultzero(5, cnt) = "'000000"
            resultzero(6, cnt) = 0
        End If
    End If
Next


ReDim temp(1 To UBound(resultzero, 2), 1 To UBound(resultzero, 1))
For i = LBound(resultzero, 2) To UBound(resultzero, 2)
    For j = LBound(resultzero, 1) To UBound(resultzero, 1)
        temp(i, j) = resultzero(j, i)
    Next
Next
resultzero = temp


cnt = 0

ReDim result(1 To 6, 1 To 1)
For i = LBound(clist, 1) To UBound(clist, 1) + 1
    If i = 1 Then
        cnt = cnt + 1
        result(1, i) = "Project"
        result(2, i) = "Package"
        result(3, i) = "ActivityVersion"
        result(4, i) = "Resource"
        result(5, i) = "System"
        result(6, i) = "PlannedBudget"
    Else
        If clist(i - 1, 14) <> "" Then
            cnt = cnt + 1
            ReDim Preserve result(1 To 6, 1 To cnt)
            result(1, cnt) = clist(i - 1, 3)
            result(3, cnt) = clist(i - 1, 2)
            result(4, cnt) = clist(i - 1, 14) & "_MP"
            result(5, cnt) = "'000000"
            result(6, cnt) = clist(i - 1, 20)
        End If
    End If
Next

ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp

fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\ERM\"

WriteArrayToCSV resultzero, fpath & "BudgetManhoursetzero.csv"
WriteArrayToCSV result, fpath & "BudgetManhour.csv"

MsgBox "ERM Total Manhour Check & Update Completed!"

End Sub


Sub UpdateVFACTtoERM()
Dim VFACTDB
VFACTDB = Sheets("VFACT").ListObjects("VFACTDB").DataBodyRange.Value

ReDim result(1 To 7, 1 To 1)
For i = LBound(VFACTDB, 1) To UBound(VFACTDB, 1) + 1
    If i = 1 Then
        cnt = cnt + 1
        result(1, i) = "Context"
        result(2, i) = "Activity"
        result(3, i) = "ActivityLabour"
        result(4, i) = "Package"
        result(5, i) = "Parent"
        result(6, i) = "Quantity"
        result(7, i) = "ReportingDate"
    Else
        If VFACTDB(i - 1, 16) <> "" And VFACTDB(i - 1, 16) > 0 Then
            cnt = cnt + 1
            ReDim Preserve result(1 To 7, 1 To cnt)
            result(1, cnt) = "GCC"
            result(2, cnt) = VFACTDB(i - 1, 2)
            result(3, cnt) = 1
            result(6, cnt) = VFACTDB(i - 1, 16)
            result(7, cnt) = VFACTDB(i - 1, 1)
        End If
    End If
Next


ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp


fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\ERM\"
WriteArrayToCSV result, fpath & "labourbackreport_VFACT.csv"

MsgBox "ERM Achieved Physical Volume (VFACT) Update Completed!"

End Sub
Sub UpdateMPDBtoERM()
Dim VFACTDB
MPDB = Sheets("MP").ListObjects("MPDB").DataBodyRange.Value

ReDim result(1 To 15, 1 To 1)
For i = LBound(MPDB, 1) To UBound(MPDB, 1) + 1
    If i = 1 Then
        cnt = cnt + 1
        result(1, i) = "context"
        result(2, i) = "Activity"
        result(3, i) = "ETC"
        result(4, i) = "Package"
        result(5, i) = "Parent"
        result(6, i) = "System"
        result(7, i) = "ManualProgress"
        result(8, i) = "ActualCost"
        result(9, i) = "ActualHours"
        result(10, i) = "Resource"
        result(11, i) = "ReportingResource"
        result(12, i) = "Note"
        result(13, i) = "ReportingDate"
        result(14, i) = "Worker"
        result(15, i) = "ExternalSystemId"

    Else
        If MPDB(i - 1, 2) <> "NULL" And MPDB(i - 1, 16) <> "" Then
            cnt = cnt + 1
            ReDim Preserve result(1 To 15, 1 To cnt)
            result(1, cnt) = "GCC"
            result(2, cnt) = MPDB(i - 1, 2) 'id
            result(6, cnt) = "000000"
            result(9, cnt) = MPDB(i - 1, 5) * 10
            result(10, cnt) = MPDB(i - 1, 3) & "_MP"
            result(11, cnt) = "GCC_" & MPDB(i - 1, 3)
            result(13, cnt) = MPDB(i - 1, 1)
        End If
    End If
Next


ReDim temp(1 To UBound(result, 2), 1 To UBound(result, 1))
For i = LBound(result, 2) To UBound(result, 2)
    For j = LBound(result, 1) To UBound(result, 1)
        temp(i, j) = result(j, i)
    Next
Next
result = temp


fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\REPORTS\ERM\"
WriteArrayToCSV result, fpath & "labourbackreport_MP.csv"

MsgBox "ERM Invested Manpower (MPDB) Update Completed!"

End Sub

Sub WriteArrayToCSV(arr As Variant, csvFile As String)
    Dim i As Long, j As Long
    Dim line As String
    Dim stream As Object
    
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 2
    stream.Charset = "utf-8"
    stream.Open
    

    'stream.WriteText ChrW(&HFEFF)
    
    For i = LBound(arr, 1) To UBound(arr, 1)
        line = ""
        For j = LBound(arr, 2) To UBound(arr, 2)
            tempstr = arr(i, j)
            If InStr(tempstr, ",") > 0 Or InStr(tempstr, """") > 0 Or InStr(tempstr, vbLf) > 0 Then
                tempstr = """" & Replace(tempstr, """", """""") & """"
            End If
            line = line & tempstr
            
            If j < UBound(arr, 2) Then
                line = line & ","
            End If
        Next j
        stream.WriteText line & vbCrLf
    Next i
    
    stream.SaveToFile csvFile, 2
    stream.Close
End Sub

Sub WriteArrayToWorksheet(arr As Variant, ws As Worksheet)
    Dim i As Long, j As Long
    
    For i = LBound(arr, 1) To UBound(arr, 1)
        For j = LBound(arr, 2) To UBound(arr, 2)
            ws.Cells(i, j).Value = arr(i, j)
        Next j
    Next i
End Sub

