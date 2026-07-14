import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Olvidecontra } from './olvidecontra';

describe('Olvidecontra', () => {
  let component: Olvidecontra;
  let fixture: ComponentFixture<Olvidecontra>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Olvidecontra],
    }).compileComponents();

    fixture = TestBed.createComponent(Olvidecontra);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
