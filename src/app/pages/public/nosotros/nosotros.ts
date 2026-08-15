import { Component } from '@angular/core';
import { RevealOnScrollDirective } from '../../../shared/reveal-on-scroll/reveal-on-scroll.directive';

interface InfoItem {
  titulo: string;
  desc: string;
}

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [RevealOnScrollDirective],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css',
})
export class NosotrosComponent {
  readonly ingenieriaItems: InfoItem[] = [
    {
      titulo: 'Soluciones corporativas de alto impacto (Caso Summas)',
      desc: 'Desarrollamos software a medida, plataformas de auditorías y sistemas de control operativo para Summas, consultora líder con más de 15 años de trayectoria especializada en la cadena de valor automotriz y transporte, responsable de operaciones y consultoría para gigantes como BMW, Audi, Toyota, Hyundai, Mercedes-Benz, Derco y Grupo Euromotors.'
    },
    {
      titulo: 'Seguridad desde el origen',
      desc: 'Aliados estratégicos de GCRBA UNMSM, el grupo de hacking ético de la Facultad de Ingeniería Electrónica y Eléctrica (FIEE) de la Universidad Nacional Mayor de San Marcos, garantizando estándares avanzados de protección e integridad de datos.'
    }
  ];

  readonly talentoItems: InfoItem[] = [
    {
      titulo: 'Alianza Estratégica IEEE WIE UPC',
      desc: 'En un sector donde más del 85% de los profesionales de ingeniería son hombres, impulsamos activamente el cierre de la brecha de género como socios tecnológicos de Women in Engineering (WIE) UPC a través de mentorías en IA, desarrollo y automatización.'
    },
    {
      titulo: 'Cantera de talento de élite',
      desc: 'Conexión directa y formación de practicantes destacados provenientes de las carreras de Ingeniería de Software, Ciberseguridad, Sistemas y Mecatrónica de la UPC, integrando a las futuras promesas técnicas en proyectos y productos de impacto real.'
    }
  ];
}