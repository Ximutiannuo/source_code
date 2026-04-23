Attribute VB_Name = "o_IPMTDB"
Sub IPMTDB()

'fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\IPMTDB\"
fpath = "C:\Users\Frail\OneDrive\Ust-Luga GCC\Procedures\IPMTDB\"
Set fso = CreateObject("scripting.filesystemobject")

Set fd = fso.GetFolder(fpath)

For Each fl In fd.Files
    Set wb = Workbooks.Open(fl.Path)
    With wb
        For Each sh In wb.Sheets
            If sh.Name = "Add template" Or sh.Name = "§º§Ñ§Ò§Ý§à§ß §à§á§Ö§â§æ§Ñ§Ü§ä§Ñ" Then
                With sh
                    If .AutoFilterMode = True Or .FilterMode = True Then
                        .ShowAllData
                    End If
                    irow = .Cells(Rows.Count, 4).End(xlUp).Row
                    arr = .Range("a5:ad" & irow)
                End With
            End If
            With ThisWorkbook.Sheets("IPMTDB_2")
                xrow = .Cells(Rows.Count, 4).End(xlUp).Row + 1
                .Range("a" & xrow).Resize(UBound(arr, 1), UBound(arr, 2)) = arr
            End With
        Next
    End With
    wb.Close False
    
Next

End Sub
