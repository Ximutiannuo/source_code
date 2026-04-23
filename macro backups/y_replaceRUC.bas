Attribute VB_Name = "y_replaceRUC"
'facility list
Sub RecheckFacilityList()

Dim vdata, blockList, wkPKG, actList
With Sheets("Facility List")
    irow = .Cells(Rows.Count, 1).End(xlUp).Row
    icol = .Cells(1, Columns.Count).End(xlToLeft).Column
    vdata = .Range(.Cells(3, 1), .Cells(irow, icol)).Value
    ReDim result(1 To UBound(vdata, 1), 1 To 1)
    For i = LBound(vdata, 1) To UBound(vdata, 1)
        result(i, 1) = ReplaceRussianChar(vdata(i, 16))
    Next
    .Range("p3").Resize(UBound(result, 1), 1) = result
End With
End Sub


Sub RecheckNameElist()

Dim elist
With Sheets("Activity List (E)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    elist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value

    ReDim result(1 To UBound(elist, 1), 1 To 1)
    For i = LBound(elist, 1) To UBound(elist, 1)
        result(i, 1) = ReplaceRussianChar(elist(i, 9))
    Next
    .Range("i6").Resize(UBound(result, 1), 1) = result
End With
End Sub

Sub RecheckNamePlist()

Dim plist
With Sheets("Activity List (P)")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    plist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value

    ReDim result(1 To UBound(plist, 1), 1 To 1)
    For i = LBound(plist, 1) To UBound(plist, 1)
        result(i, 1) = ReplaceRussianChar(plist(i, 9))
    Next
    .Range("i6").Resize(UBound(result, 1), 1) = result
End With
End Sub


Sub RecheckNameClist()

Dim clist
With Sheets("Activity List")
    irow = .Cells(Rows.Count, 3).End(xlUp).Row
    icol = .Cells(5, Columns.Count).End(xlToLeft).Column
    clist = .Range(.Cells(6, 1), .Cells(irow, icol)).Value

    ReDim result(1 To UBound(clist, 1), 1 To 1)
    For i = LBound(clist, 1) To UBound(clist, 1)
        result(i, 1) = ReplaceRussianChar(clist(i, 9))
    Next
    .Range("i6").Resize(UBound(result, 1), 1) = result
End With
End Sub

Function ReplaceRussianChar(ByVal rplc As String)
Dim i As Long, arr, j As Long, res As Variant, irow
Dim regEx As New RegExp, brr, te, crr, excl, s
Dim mc As MatchCollection, item As Variant

Set regEx = CreateObject("vbscript.regexp")

arr = rplc
res = Sheets("RUC").Range("a1:b24").Value


For j = LBound(res, 1) To UBound(res, 1)
    regEx.Global = True
    regEx.IgnoreCase = False
    regEx.Pattern = res(j, 1)
    Set mc = regEx.Execute(arr)
    If mc.Count >= 1 Then
        arr = regEx.Replace(arr, res(j, 2))
    End If
Next
arr = Trim(arr)
ReplaceRussianChar = arr

End Function
