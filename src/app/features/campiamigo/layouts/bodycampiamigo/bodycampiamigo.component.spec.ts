import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BodycampiamigoComponent } from './bodycampiamigo.component';

describe('BodycampiamigoComponent', () => {
  let component: BodycampiamigoComponent;
  let fixture: ComponentFixture<BodycampiamigoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BodycampiamigoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BodycampiamigoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
