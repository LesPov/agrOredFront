import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderCampiamigoComponent } from './header-campiamigo.component';


describe('HeaderComponent', () => {
  let component: HeaderCampiamigoComponent;
  let fixture: ComponentFixture<HeaderCampiamigoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderCampiamigoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderCampiamigoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
