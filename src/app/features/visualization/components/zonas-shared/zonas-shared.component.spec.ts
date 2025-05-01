import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZonasSharedComponent } from './zonas-shared.component';

describe('ZonasSharedComponent', () => {
  let component: ZonasSharedComponent;
  let fixture: ComponentFixture<ZonasSharedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZonasSharedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZonasSharedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
