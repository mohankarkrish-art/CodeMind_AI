
from django.contrib import admin
from django.urls import path
from django.shortcuts import render
from django.http import HttpResponse
from assistant_app import views

def home(request):
    return render(request, "index.html")

urlpatterns = [
    path("", home, name="home"),
    path("api/health/", views.health, name="health"),
    path("api/documents/", views.documents, name="documents"),
    path("api/upload/", views.upload, name="upload"),
    path("api/analyze/", views.analyze, name="analyze"),
]
