import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Suscripciones } from './suscripciones';

describe('Suscripciones', () => {
  let component: Suscripciones;
  let fixture: ComponentFixture<Suscripciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Suscripciones],
    }).compileComponents();

    fixture = TestBed.createComponent(Suscripciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
