'use client'

// (file unchanged above)

// FIND THIS BLOCK AND REPLACE ONLY handleCreateRow

  async function handleCreateRow() {
    if (!access?.canManage) {
      setError('Manage access required.')
      return null
    }
    if (!header) return null

    // NEW RULE: description required, catalog optional
    if (!newDescription.trim()) {
      setError('Description is required.')
      return null
    }

    setCreatingRow(true)
    setError(null)

    try {
      const created = await createPricingRow(supabase, {
        pricing_header_id: header.id,
        catalog_sku: newCatalogSku || null,
        description_snapshot: newDescription || null,
        vendor_sku: newVendorSku || null,
        unit: newUnit || null,
        unit_price: parseNullableNumber(newUnitPrice),
        lead_days: parseNullableNumber(newLeadDays),
        notes: newNotes || null,
      })

      const nextRows = [...localRowsRef.current, created]
      setLocalRowsSync(nextRows)
      setServerRowsSync([...serverRowsRef.current, created])
      setRowState(created.id, 'idle')

      setNewCatalogSku('')
      setNewDescription('')
      setNewVendorSku('')
      setNewUnit('')
      setNewUnitPrice('')
      setNewLeadDays('')
      setNewNotes('')

      if (!isMobileViewport) {
        focusCell(created.id, 'description_snapshot')
      }

      return created
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add row.')
      return null
    } finally {
      setCreatingRow(false)
    }
  }

// END PATCH
