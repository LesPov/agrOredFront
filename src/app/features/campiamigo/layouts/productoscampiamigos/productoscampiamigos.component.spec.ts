import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductoscampiamigosComponent } from './productoscampiamigos.component';

describe('ProductoscampiamigosComponent', () => {
  let component: ProductoscampiamigosComponent;
  let fixture: ComponentFixture<ProductoscampiamigosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoscampiamigosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductoscampiamigosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
