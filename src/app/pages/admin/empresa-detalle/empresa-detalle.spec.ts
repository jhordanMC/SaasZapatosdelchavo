import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmpresaDetalle } from './empresa-detalle';

describe('EmpresaDetalle', () => {
  let component: EmpresaDetalle;
  let fixture: ComponentFixture<EmpresaDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpresaDetalle],
    }).compileComponents();

    fixture = TestBed.createComponent(EmpresaDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
