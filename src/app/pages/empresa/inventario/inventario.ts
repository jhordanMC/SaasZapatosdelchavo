import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categoria, Producto, ProductosService, Sexo, VarianteProducto } from '../../../services/productos';

interface VarianteFormItem {
  talla: string;
  stock: number;
  local: string;
}

const CATEGORIAS: Categoria[] = ['Deportivos', 'Casuales', 'Formales', 'Botines', 'Sandalias', 'Escolares', 'Textiles'];
const SEXOS: Sexo[] = ['Hombre', 'Mujer', 'Niño', 'Niña', 'Unisex'];

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.css'],
})
export class InventarioComponent {
  productosSignal;

  constructor(private productosService: ProductosService) {
    this.productosSignal = this.productosService.getProductos();
  }

  categorias = CATEGORIAS;
  sexos = SEXOS;

  busqueda = '';
  filtroCategoria: Categoria | 'Todas' = 'Todas';
  filtroSexo: Sexo | 'Todos' = 'Todos';

  showModal = false;
  editandoId: string | null = null;

  form: {
    nombre: string;
    categoria: Categoria;
    sexo: Sexo;
    costoCompra: number;
    precioVenta: number;
    fotoUrl: string | null;
    variantes: VarianteFormItem[];
  } = this.formVacio();

  get productos(): Producto[] {
    return this.productosSignal().filter((p) => {
      if (this.busqueda && !p.nombre.toLowerCase().includes(this.busqueda.toLowerCase())) return false;
      if (this.filtroCategoria !== 'Todas' && p.categoria !== this.filtroCategoria) return false;
      if (this.filtroSexo !== 'Todos' && p.sexo !== this.filtroSexo) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.filtroCategoria !== 'Todas' || this.filtroSexo !== 'Todos');
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroCategoria = 'Todas';
    this.filtroSexo = 'Todos';
  }

  stockTotal(p: Producto): number {
    return this.productosService.stockTotal(p);
  }

  margen(p: Producto): number {
    return this.productosService.margen(p);
  }

  private formVacio() {
    return {
      nombre: '',
      categoria: 'Casuales' as Categoria,
      sexo: 'Unisex' as Sexo,
      costoCompra: 0,
      precioVenta: 0,
      fotoUrl: null as string | null,
      variantes: [{ talla: '', stock: 0, local: '' }] as VarianteFormItem[],
    };
  }

  abrirModalNuevo(): void {
    this.editandoId = null;
    this.form = this.formVacio();
    this.showModal = true;
  }

  abrirModalEditar(p: Producto): void {
    this.editandoId = p.id;
    this.form = {
      nombre: p.nombre,
      categoria: p.categoria,
      sexo: p.sexo,
      costoCompra: p.costoCompra,
      precioVenta: p.precioVenta,
      fotoUrl: p.fotoUrl,
      variantes: p.variantes.map((v) => ({ talla: v.talla, stock: v.stock, local: v.local })),
    };
    this.showModal = true;
  }

  cerrarModal(): void {
    this.showModal = false;
  }

  agregarFilaVariante(): void {
    this.form.variantes.push({ talla: '', stock: 0, local: '' });
  }

  quitarFilaVariante(index: number): void {
    this.form.variantes.splice(index, 1);
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (this.form.fotoUrl = reader.result as string);
    reader.readAsDataURL(file);
  }

  guardar(): void {
    if (!this.form.nombre.trim()) return;

    const variantes: VarianteProducto[] = this.form.variantes
      .filter((v) => v.talla.trim())
      .map((v, i) => ({ id: `${this.editandoId ?? 'nuevo'}-v${i}`, talla: v.talla, stock: v.stock, local: v.local }));

    if (this.editandoId) {
      this.productosService.actualizarProducto(this.editandoId, {
        nombre: this.form.nombre,
        categoria: this.form.categoria,
        sexo: this.form.sexo,
        costoCompra: this.form.costoCompra,
        precioVenta: this.form.precioVenta,
        fotoUrl: this.form.fotoUrl,
        variantes,
      });
    } else {
      this.productosService.agregarProducto({
        nombre: this.form.nombre,
        categoria: this.form.categoria,
        sexo: this.form.sexo,
        costoCompra: this.form.costoCompra,
        precioVenta: this.form.precioVenta,
        fotoUrl: this.form.fotoUrl,
        variantes,
      });
    }

    this.showModal = false;
  }

  eliminar(p: Producto): void {
    if (confirm(`¿Eliminar "${p.nombre}" del inventario?`)) {
      this.productosService.eliminarProducto(p.id);
    }
  }
}
