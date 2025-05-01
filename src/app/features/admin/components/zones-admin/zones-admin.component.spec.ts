import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZonesAdminComponent } from './zones-admin.component';

describe('ZonesAdminComponent', () => {
  let component: ZonesAdminComponent;
  let fixture: ComponentFixture<ZonesAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZonesAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZonesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
