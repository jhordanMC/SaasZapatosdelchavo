import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from '../../../shared/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/topbar/topbar';
import {
  Chart,
  LineController,
  PieController,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
} from 'chart.js';

Chart.register(
  LineController,
  PieController,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
);

interface Venta {
  id: number;
  productName: string;
  customer: string;
  quantity: number;
  total: number;
  status: 'completed' | 'pending' | 'cancelled';
}

interface StockBajo {
  id: number;
  name: string;
  sku: string;
  location: string;
  stock: number;
  minStock: number;
}

interface MesData {
  month: string;
  revenue: number;
  profit: number;
}

interface CategoriaData {
  category: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TopbarComponent, SidebarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardUsuarioComponent implements AfterViewInit {

  @ViewChild('lineChart') lineChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart') pieChartRef!: ElementRef<HTMLCanvasElement>;

  showLogoFallback = false;

  // ── KPIs ──
  totalInventario = 146;
  productosUnicos = 8;
  ingresosTotales = 6199.77;
  ventasCompletadas = 6;
  alertasStock = 1;

  // ── Mock data (reemplazar luego con servicio real / stored procedures) ──
  ventasRecientes: Venta[] = [
    { id: 1, productName: 'Laptop Dell XPS 15', customer: 'Empresa Tech Solutions', quantity: 2, total: 2599.98, status: 'completed' },
    { id: 2, productName: 'Mouse Logitech MX Master 3', customer: 'Juan García', quantity: 3, total: 299.97, status: 'completed' },
    { id: 3, productName: 'Teclado Mecánico Keychron', customer: 'María López', quantity: 1, total: 149.99, status: 'pending' },
    { id: 4, productName: 'Monitor LG 27"', customer: 'Carlos Ramírez', quantity: 2, total: 899.98, status: 'completed' },
    { id: 5, productName: 'Auriculares Sony WH-1000', customer: 'Ana Torres', quantity: 1, total: 249.85, status: 'cancelled' },
  ];

  stockBajo: StockBajo[] = [
    { id: 3, name: 'Teclado Mecánico Keychron K2', sku: 'PROD-003', location: 'Almacén A · Estante 2', stock: 3, minStock: 10 },
  ];

  private monthly: MesData[] = [
    { month: 'Oct', revenue: 12500, profit: 4200 },
    { month: 'Nov', revenue: 14800, profit: 5100 },
    { month: 'Dic', revenue: 19200, profit: 6800 },
    { month: 'Ene', revenue: 13400, profit: 4600 },
    { month: 'Feb', revenue: 16700, profit: 5900 },
    { month: 'Mar', revenue: 18200, profit: 6300 },
    { month: 'Abr', revenue: 23100, profit: 8200 },
  ];

  private categorias: CategoriaData[] = [
    { category: 'Electrónica', value: 45 },
    { category: 'Periféricos', value: 35 },
    { category: 'Audio', value: 12 },
    { category: 'Almacenamiento', value: 5 },
    { category: 'Mobiliario', value: 3 },
  ];

  ngAfterViewInit(): void {
    this.renderLineChart();
    this.renderPieChart();
  }

  onLogoError(event: Event): void {
    this.showLogoFallback = true;
    (event.target as HTMLImageElement).style.display = 'none';
  }

  statusLabel(status: Venta['status']): string {
    return status === 'completed' ? 'Completada' : status === 'pending' ? 'Pendiente' : 'Cancelada';
  }

  stockPct(p: StockBajo): number {
    return Math.round((p.stock / p.minStock) * 100);
  }

  private renderLineChart(): void {
    new Chart(this.lineChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.monthly.map(d => d.month),
        datasets: [
          {
            label: 'Ingresos',
            data: this.monthly.map(d => d.revenue),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.06)',
            borderWidth: 2.5,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Ganancia',
            data: this.monthly.map(d => d.profit),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.04)',
            borderWidth: 2.5,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Poppins', size: 11 }, boxWidth: 10, padding: 16 }
          },
          tooltip: { bodyFont: { family: 'Poppins' }, titleFont: { family: 'Poppins' } }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#7aaa95' } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#7aaa95' } }
        }
      }
    });
  }

  private renderPieChart(): void {
    new Chart(this.pieChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: this.categorias.map(d => `${d.category}: ${d.value}%`),
        datasets: [{
          data: this.categorias.map(d => d.value),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          borderWidth: 2,
          borderColor: 'white',
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { family: 'Poppins', size: 11 }, boxWidth: 10, padding: 12 }
          },
          tooltip: { bodyFont: { family: 'Poppins' }, titleFont: { family: 'Poppins' } }
        }
      }
    });
  }
}