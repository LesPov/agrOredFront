import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewzonesAdminComponent } from './viewzones-admin.component';

describe('ViewzonesAdminComponent', () => {
  let component: ViewzonesAdminComponent;
  let fixture: ComponentFixture<ViewzonesAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewzonesAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewzonesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
