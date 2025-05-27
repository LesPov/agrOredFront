import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardcampiamigoComponent } from './dashboardcampiamigo.component';

describe('DashboardcampiamigoComponent', () => {
  let component: DashboardcampiamigoComponent;
  let fixture: ComponentFixture<DashboardcampiamigoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardcampiamigoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardcampiamigoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
