using RagMiddleware.Infrastructure.Configuration;
using Microsoft.Extensions.Options;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Infrastructure.Clients;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<RagApiOptions>()
    .Bind(
        builder.Configuration.GetSection(
            RagApiOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHttpClient<IRagApiClient, RagApiClient>(
    (serviceProvider, httpClient) =>
    {
        RagApiOptions options = serviceProvider
            .GetRequiredService<IOptions<RagApiOptions>>()
            .Value;

        httpClient.BaseAddress = new Uri(
            $"{options.BaseUrl.TrimEnd('/')}/"
        );

        httpClient.Timeout = TimeSpan.FromMinutes(5);
    }
);
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapControllers();

app.Run();