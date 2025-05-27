import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarCampiamigoComponent } from './navbar-campiamigo.component';

describe('NavbarCampiamigoComponent', () => {
  let component: NavbarCampiamigoComponent;
  let fixture: ComponentFixture<NavbarCampiamigoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarCampiamigoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarCampiamigoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
