Attribute VB_Name = "h_seperate"
'trigger this procedure after running PQ to get the latest data input by the engineers


Sub SeperateActListbySubproject()

'Application.ScreenUpdating = False
'Application.Calculation = xlCalculationManual

startTime = Timer

Set fso = CreateObject("scripting.filesystemobject")
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\R1\"

With Sheets("UpdateQuantity")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column - 2
    SUPP = .Range(.Cells(2, 1), .Cells(irow, icol))
End With

With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 1
    DataRange = .Range(.Cells(6, 1), .Cells(irow, icol))
End With

'3,5,6,10 project, team, name, id
Set fd = fso.GetFolder(fpath)
For Each subfd In fd.SubFolders
    ReDim temp(1 To UBound(DataRange, 1), 1 To icol)
    Set d = CreateObject("scripting.dictionary")
    For i = 1 To UBound(DataRange, 1)
        If DataRange(i, 4) = subfd.Name Then
            tempstr = DataRange(i, 12)
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
        End If
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
        Workbooks.Add
        With ActiveSheet
            .Range("j2:j" & UBound(t(i)(1)) + 2).NumberFormat = "@"
            For j = LBound(DataRange, 2) To 18
                .Cells(1, j) = ThisWorkbook.Sheets("Activity List").Cells(5, j)
            Next
            .Cells(1, 19).Value = "预估总量（工程师根据DDD/FEED文件更新）"
            .Cells(1, 20).Value = "图纸批准量AFC（工程师根据DDD文件更新）"
            .Cells(1, 21).Value = "材料到货量（工程师根据到货信息更新）"
            .Cells(1, 22).Value = "现有可施工工作面（工程师根据现场情况更新）"
            .Cells(1, 23).Value = "工作面受限（材料因素，工程师更新）"
            .Cells(1, 24).Value = "工作面受限（现场因素，工程师更新）"
            .Cells(1, 25).Value = "施工完成（计划部通过日报更新，请勿填写）"
            .Cells(1, 26).Value = "RFI 验收完成量（A）"
            .Cells(1, 27).Value = "RFI 验收完成量（B）"
            .Cells(1, 28).Value = "RFI 验收完成量（C）"
            .Cells(1, 29).Value = "竣工资料签署量（R0）"
            .Cells(1, 30).Value = "竣工资料签署量（R1）"
            .Cells(1, 31).Value = "OBP签署量"
            .Cells(1, 32).Value = "最早开始时间（计划部通过日报更新，请勿填写）"
            .Cells(1, 33).Value = "最晚更新日期（计划部通过日报更新，请勿填写）"
            .Cells(1, 34).Value = "施工部责任人"
            .Cells(1, 35).Value = "备注"
            For m = LBound(t(i)) To 18
                For n = LBound(t(i)(m)) To UBound(t(i)(m))
                    .Cells(n + 2, m) = t(i)(m)(n)
                Next
            Next
            
            For m = LBound(t(i)(1)) To UBound(t(i)(1))
                .Cells(m + 2, 25) = t(i)(35)(m)
                .Cells(m + 2, 32) = t(i)(32)(m)
                .Cells(m + 2, 33) = t(i)(33)(m)
                For mm = LBound(SUPP, 1) To UBound(SUPP, 1)
                    If t(i)(2)(m) = SUPP(mm, 1) Then
                        .Cells(m + 2, 19) = SUPP(mm, 2)
                        .Cells(m + 2, 20) = SUPP(mm, 3)
                        .Cells(m + 2, 21) = SUPP(mm, 4)
                        .Cells(m + 2, 22) = SUPP(mm, 5)
                        .Cells(m + 2, 23) = SUPP(mm, 6)
                        .Cells(m + 2, 24) = SUPP(mm, 7)
                        .Cells(m + 2, 26) = SUPP(mm, 9)
                        .Cells(m + 2, 27) = SUPP(mm, 10)
                        .Cells(m + 2, 28) = SUPP(mm, 11)
                        .Cells(m + 2, 29) = SUPP(mm, 12)
                        .Cells(m + 2, 30) = SUPP(mm, 13)
                        .Cells(m + 2, 31) = SUPP(mm, 14)

                        .Cells(m + 2, 34) = SUPP(mm, 18)
                        .Cells(m + 2, 35) = SUPP(mm, 19)
                    End If
                Next
            Next
            lastRow = .Cells(Rows.Count, 1).End(xlUp).Row
            .Range("s2:ae" & lastRow).NumberFormat = "0.00"
            .Range("af2:ag" & lastRow).NumberFormat = "yyyy/m/d"
    '        .Range("n2:n" & lastrow).Validation.Add Type:=xlValidateList, _
    '        AlertStyle:=xlValidAlertStop, Operator:=xlBetween, Formula1:="IFR 图算量, IFC 图算量, AFC 图算量, 预估量, 确认无此项工作"
            
            
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
                .Range("s1:ah1").EntireColumn.ColumnWidth = 12
                .Range("s1:ah1").WrapText = True
                .Range("s1:ab1").Font.Size = 9
                .Range("ai1").EntireColumn.ColumnWidth = 20
                If ActiveSheet.AutoFilterMode = True Then
                Else
                    .Range("a1").CurrentRegion.AutoFilter
                End If
            End With
            
            .Range("b2").Select
            ActiveWindow.FreezePanes = True
        End With
        For Each fl In subfd.Files
            If fl.Name = k(i) & ".xlsx" Then
                Kill fl
            End If
        Next
        ActiveWorkbook.SaveAs Filename:=fpath & subfd.Name & "\" & k(i), FileFormat:=51
        ActiveWorkbook.AutoSaveOn = True
        ActiveWorkbook.Close True
    Next
Next
'Application.ScreenUpdating = True
'Application.Calculation = xlCalculationAutomatic

SeperateActivitybyConstructionTeams



FinishTime = Timer
ElapsedTime = FinishTime - startTime
MsgBox "File Distribution Completed, Elapsed Time: " & Format(ElapsedTime \ 60, "00") & ":" & Format(ElapsedTime Mod 60, "00") & "."

End Sub

Sub CollectInformation()

Application.ScreenUpdating = False
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column - 12
    arr = .Range(.Cells(6, 1), .Cells(irow, icol))
End With
ReDim brr(1 To 16, 1 To 1)
ReDim erCollection(1 To 16, 1 To 1)
ReDim emptyColletion(1 To 16, 1 To 1)

Set fso = CreateObject("scripting.filesystemobject")
Set fd = fso.GetFolder("C:\Users\Xie Guangjie\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown")
For Each subfd In fd.SubFolders
    For Each fl In subfd.Files
        Set wb = Workbooks.Open(fl.Path, False, True)
        With wb.Sheets(1)
            If (ActiveSheet.AutoFilterMode And ActiveSheet.FilterMode) Or ActiveSheet.FilterMode Then
              ActiveSheet.ShowAllData
            End If
            irow = .Cells(Rows.Count, 1).End(xlUp).Row
            icol = .Cells(1, Columns.Count).End(xlToLeft).Column
            DataRange = .Range(.Cells(1, 1), .Cells(irow, icol)).Value

            For i = 2 To UBound(DataRange, 1)
                If Not IsEmpty(DataRange(i, 14)) Then
                    cnt = cnt + 1
                    ReDim Preserve brr(1 To 16, 1 To cnt)
                    For j = LBound(DataRange, 2) To UBound(DataRange, 2)
                        brr(j, cnt) = DataRange(i, j)
                    Next
                End If

                If VarType(DataRange(i, 15)) = vbString Then
                    cnter = cnter + 1
                    ReDim Preserve erCollection(1 To 16, 1 To cnter)
                    For j = LBound(DataRange, 2) To UBound(DataRange, 2)
                        erCollection(j, cnter) = DataRange(i, j)
                    Next
                End If
                If Len(DataRange(i, 12)) > 0 And IsEmpty(DataRange(i, 14)) Then
                    cntem = cntem + 1
                    ReDim Preserve emptyColletion(1 To 16, 1 To cntem)
                    For j = LBound(DataRange, 2) To UBound(DataRange, 2)
                        emptyColletion(j, cntem) = DataRange(i, j)
                    Next
                End If
            Next

        End With
        wb.Close False

    Next
Next
Application.ScreenUpdating = True
ReDim temp1(1 To UBound(brr, 2), 1 To UBound(brr, 1))
For i = LBound(brr, 2) To UBound(brr, 2)
    For j = LBound(brr, 1) To UBound(brr, 1)
        temp1(i, j) = brr(j, i)
    Next
Next
brr = temp1
ReDim temp2(1 To UBound(erCollection, 2), 1 To UBound(erCollection, 1))
For i = LBound(erCollection, 2) To UBound(erCollection, 2)
    For j = LBound(erCollection, 1) To UBound(erCollection, 1)
        temp2(i, j) = erCollection(j, i)
    Next
Next
erCollection = temp2
ReDim temp3(1 To UBound(emptyColletion, 2), 1 To UBound(emptyColletion, 1))
For i = LBound(emptyColletion, 2) To UBound(emptyColletion, 2)
    For j = LBound(emptyColletion, 1) To UBound(emptyColletion, 1)
        temp3(i, j) = emptyColletion(j, i)
    Next
Next
emptyCollection = temp3

Sheets("Temp_Completed").Range("a2").Resize(UBound(brr, 1), UBound(brr, 2)) = brr
Sheets("Temp_Err").Range("a2").Resize(UBound(erCollection, 1), UBound(erCollection, 2)) = erCollection
Sheets("Temp_Empty").Range("a2").Resize(UBound(emptyCollection, 1), UBound(emptyCollection, 2)) = emptyCollection



End Sub

Sub TurnOn()
'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\PEL\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\GCC EGPC Project Level 3 Schedule Breakdown\PEL\"
Set fso = CreateObject("scripting.filesystemobject")
Set fd = fso.GetFolder(fpath)

For Each fl In fd.Files
    Set wb = Workbooks.Open(fl.Path, False)
    With ActiveWorkbook
        .AutoSaveOn = True
        .Close
    End With
Next
End Sub
