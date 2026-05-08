import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Genera un Remito de Entrega en PDF
 * @param {Object} delivery - datos de la entrega
 * @param {Array} items - ítems de la entrega
 */
export function generateRemitoPDF(delivery, items) {
	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.getWidth();

	// ─── Header ───────────────────────────────────────────────────
	doc.setFillColor(30, 30, 42);
	doc.rect(0, 0, pageWidth, 40, 'F');

	doc.setTextColor(255, 255, 255);
	doc.setFontSize(20);
	doc.setFont('helvetica', 'bold');
	doc.text('REMITO DE ENTREGA', 14, 18);

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(180, 180, 200);
	doc.text('Sistema de Gestión — Inventario Pañol', 14, 28);

	// Número y fecha
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	doc.text(`N° ${String(delivery.id).padStart(6, '0')}`, pageWidth - 14, 18, { align: 'right' });
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	const fecha = new Date(delivery.created_at || Date.now()).toLocaleDateString('es-AR', {
		day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
	});
	doc.text(fecha, pageWidth - 14, 28, { align: 'right' });

	// ─── Info block ───────────────────────────────────────────────
	doc.setTextColor(40, 40, 40);
	doc.setFontSize(10);

	let y = 52;
	doc.setFont('helvetica', 'bold');
	doc.text('Datos de la Entrega', 14, y);
	doc.setFont('helvetica', 'normal');
	y += 8;

	const infoRows = [
		['Responsable:', delivery.responsible_name || '—'],
		['Proyecto/Curso:', delivery.project_name || '—'],
		['Estado:', delivery.status || 'Pendiente'],
		['Observaciones:', delivery.notes || '—'],
	];

	doc.setFontSize(9);
	for (const [label, value] of infoRows) {
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(80, 80, 100);
		doc.text(label, 14, y);
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(40, 40, 40);
		doc.text(value, 55, y);
		y += 7;
	}

	// ─── Items table ──────────────────────────────────────────────
	y += 6;
	autoTable(doc, {
		startY: y,
		head: [['SKU', 'Componente', 'Ubicación', 'Cantidad', 'Unidad']],
		body: items.map(item => [
			item.material_sku || '—',
			item.material_name || '—',
			item.location_name || '—',
			item.quantity?.toString() || '0',
			item.unit_of_measure || '—'
		]),
		theme: 'grid',
		headStyles: {
			fillColor: [99, 102, 241],
			textColor: 255,
			fontStyle: 'bold',
			fontSize: 9
		},
		bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
		alternateRowStyles: { fillColor: [248, 248, 252] },
		columnStyles: {
			0: { cellWidth: 28 },
			3: { halign: 'right' },
			4: { cellWidth: 22 }
		},
		margin: { left: 14, right: 14 }
	});

	const finalY = doc.lastAutoTable.finalY + 16;

	// ─── Firma ────────────────────────────────────────────────────
	doc.setDrawColor(180, 180, 200);
	doc.setLineWidth(0.4);

	// Firma receptor
	doc.line(14, finalY + 20, 90, finalY + 20);
	doc.setFontSize(8);
	doc.setTextColor(100, 100, 120);
	doc.text('Firma y Aclaración del Responsable', 14, finalY + 27);

	// Firma encargado
	doc.line(pageWidth - 90, finalY + 20, pageWidth - 14, finalY + 20);
	doc.text('Firma del Encargado del Pañol', pageWidth - 90, finalY + 27);

	// ─── Footer ───────────────────────────────────────────────────
	const pageHeight = doc.internal.pageSize.getHeight();
	doc.setFillColor(240, 240, 248);
	doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
	doc.setFontSize(7);
	doc.setTextColor(140, 140, 160);
	doc.text('Documento generado automáticamente — Inventario Pañol', pageWidth / 2, pageHeight - 5, { align: 'center' });

	// ─── Save ─────────────────────────────────────────────────────
	doc.save(`remito-entrega-${String(delivery.id).padStart(6, '0')}.pdf`);
}
