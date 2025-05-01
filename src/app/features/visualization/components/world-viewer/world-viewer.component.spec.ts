import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorldViewerComponent } from './world-viewer.component';

describe('WorldViewerComponent', () => {
  let component: WorldViewerComponent;
  let fixture: ComponentFixture<WorldViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorldViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorldViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
