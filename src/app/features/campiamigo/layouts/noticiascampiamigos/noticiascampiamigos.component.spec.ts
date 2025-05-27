import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoticiascampiamigosComponent } from './noticiascampiamigos.component';

describe('NoticiascampiamigosComponent', () => {
  let component: NoticiascampiamigosComponent;
  let fixture: ComponentFixture<NoticiascampiamigosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoticiascampiamigosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NoticiascampiamigosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
